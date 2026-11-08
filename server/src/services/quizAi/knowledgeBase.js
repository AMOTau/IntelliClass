// Layer 2 — knowledge base injection.
// Turns uploaded PDF text into chapters/sections and builds the excerpt block
// the model is restricted to.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../../config/db.js';
import { extractPdfText, LEGACY_STORED_TEXT_CHARS } from '../../utils/pdfText.js';

const uploadsRoot = fileURLToPath(new URL('../../../uploads', import.meta.url));

const DOT_LEADER = /(?:\.\s?){4,}\s*\d*\s*$/;
const NUMERIC_CHAPTER = /^(\d{1,2})\.\s+([A-Z“"'(][^]{2,160})$/;
const KEYWORD_CHAPTER = /^(chapter|unit|module|lesson|topic|section|part)\s+([0-9]{1,2}|[A-Z]|[IVX]{1,5})\b\s*[:.\-–—]?\s*(.*)$/i;
const NUMERIC_SECTION = /^(\d{1,2})\.(\d{1,2})\s+([A-Z“"'(][^]{2,160})$/;

const STOPWORDS = new Set(`about above after again against because before being below between both could does doing during each from further have having here hers herself himself into itself just more most other ought ours ourselves over same should some such than that their theirs them themselves then there these they this those through under until very were what when where which while whom would your yours yourself yourselves with will also only can its it's the and for are but not you all any our out who how why use used using one two may might must shall into onto upon been being these notes note page`.split(/\s+/));

export function tokenize(text) {
  return (String(text || '').toLowerCase().match(/[a-z][a-z’'-]{3,}/g) || [])
    .map((word) => word.replace(/[’']s$/, ''))
    .filter((word) => !STOPWORDS.has(word));
}

function isNoiseLine(line) {
  const trimmed = line.trim();
  return !trimmed
    || DOT_LEADER.test(trimmed)
    || /^\d{1,3}$/.test(trimmed)
    || /^[•·▪●◦\-–—]+$/.test(trimmed);
}

// Contents pages list every heading, so models asked to "write questions"
// from them produce topic lists instead of questions.
export function stripTableOfContents(text) {
  const lines = String(text || '').split('\n');
  const searchLimit = Math.max(40, Math.floor(lines.length * 0.4));
  let lastLeader = -1;
  let leaderCount = 0;

  for (let index = 0; index < Math.min(lines.length, searchLimit); index += 1) {
    if (DOT_LEADER.test(lines[index].trim())) {
      lastLeader = index;
      leaderCount += 1;
    }
  }

  const bodyLines = leaderCount >= 3 ? lines.slice(lastLeader + 1) : lines;
  return bodyLines.filter((line) => !isNoiseLine(line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function hasOpenBracket(text) {
  return (text.match(/\(/g) || []).length > (text.match(/\)/g) || []).length
    || (text.match(/“/g) || []).length > (text.match(/”/g) || []).length;
}

function joinWrappedHeading(lines, index, title) {
  const next = lines[index + 1]?.trim() ?? '';
  if (!next || next.length >= 80) {
    return { title, consumed: 0 };
  }
  if (hasOpenBracket(title) || (!/[.?!:)]$/.test(title) && /^[a-z(“"]/.test(next))) {
    return { title: `${title}${/\.$/.test(title) ? '' : ' '}${next}`.trim(), consumed: 1 };
  }
  return { title, consumed: 0 };
}

const ASSESSMENT_TITLE = /self[-\s]?check|self[-\s]?assessment|exam[-\s]style|question bank|model answers|answers to|sources and further reading|references|bibliography/i;

export function isAssessmentTitle(title) {
  return ASSESSMENT_TITLE.test(title || '');
}

function cleanTitle(title) {
  return title.replace(/\s+/g, ' ').replace(/\s*\(E\.\s*/g, ' (E.').trim().slice(0, 140);
}

// A chapter heading is "N. Title"; it is "strong" when an "N.1" subsection
// follows soon after, which separates real headings from numbered lists.
function detectNumericChapters(lines) {
  const matches = [];

  lines.forEach((rawLine, index) => {
    const match = rawLine.trim().match(NUMERIC_CHAPTER);
    if (!match) {
      return;
    }
    const number = match[1];
    const strong = lines
      .slice(index + 1, index + 12)
      .some((next) => new RegExp(`^${number}\\.1\\s+[A-Z“"'(]`).test(next.trim()));
    if (strong || match[2].split(/\s+/).length >= 3) {
      matches.push({ number: Number(number), rawTitle: match[2], startLine: index, strong });
    }
  });

  const chapters = [];
  let position = -1;

  for (let expected = 1; expected <= 40; expected += 1) {
    const options = matches.filter((item) => item.number === expected && item.startLine > position);
    const pick = options.find((item) => item.strong) || options[0];
    if (!pick) {
      break;
    }
    const { title } = joinWrappedHeading(lines, pick.startLine, pick.rawTitle);
    chapters.push({ number: String(expected), title: `${expected}. ${cleanTitle(title)}`, startLine: pick.startLine, strong: pick.strong });
    position = pick.startLine;
  }

  if (chapters.filter((item) => item.strong).length === 0 && chapters.length < 2) {
    return [];
  }
  return chapters.length >= 2 ? chapters : [];
}

function detectKeywordChapters(lines) {
  const seen = new Set();
  const chapters = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const match = line.match(KEYWORD_CHAPTER);
    if (!match || line.length > 160) {
      return;
    }

    const key = `${match[1].toLowerCase()}-${match[2].toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const { title } = joinWrappedHeading(lines, index, line);
    chapters.push({ number: match[2], title: cleanTitle(title), startLine: index });
  });

  return chapters.length >= 2 ? chapters : [];
}

function detectSections(lines, chapterNumber) {
  const sections = [];
  let lastSection = 0;

  lines.forEach((rawLine, index) => {
    const match = rawLine.trim().match(NUMERIC_SECTION);
    if (!match || match[1] !== String(chapterNumber)) {
      return;
    }
    const sectionNumber = Number(match[2]);
    if (sectionNumber <= lastSection) {
      return;
    }
    lastSection = sectionNumber;
    const { title } = joinWrappedHeading(lines, index, match[3]);
    sections.push({ title: `${match[1]}.${match[2]} ${cleanTitle(title)}`, startLine: index });
  });

  return sections;
}

function sliceSections(lines, sections) {
  return sections.map((section, index) => {
    const endLine = sections[index + 1]?.startLine ?? lines.length;
    return {
      title: section.title,
      text: lines.slice(section.startLine, endLine).join('\n').trim(),
      isAssessment: isAssessmentTitle(section.title),
    };
  });
}

function splitIntoParts(text, targetChars = 8000) {
  const paragraphs = text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const parts = [];
  let current = [];
  let size = 0;

  for (const paragraph of paragraphs) {
    if (size + paragraph.length > targetChars && current.length) {
      parts.push(current.join('\n\n'));
      current = [];
      size = 0;
    }
    current.push(paragraph);
    size += paragraph.length;
  }
  if (current.length) {
    parts.push(current.join('\n\n'));
  }

  return parts.map((partText, index) => {
    const firstLine = partText.split('\n').find((line) => line.trim().length > 8) || `Part ${index + 1}`;
    return {
      title: `Part ${index + 1}: ${firstLine.trim().slice(0, 60)}`,
      text: partText,
      sections: [],
    };
  });
}

export function buildChapters(rawText) {
  const body = stripTableOfContents(rawText);
  if (!body) {
    return [];
  }

  const lines = body.split('\n');
  let headings = detectNumericChapters(lines);
  if (headings.length === 0) {
    headings = detectKeywordChapters(lines);
  }

  if (headings.length === 0) {
    return splitIntoParts(body).map((part, index) => ({ id: `p${index + 1}`, isAssessment: false, ...part }));
  }

  const chapters = [];
  const introText = lines.slice(0, headings[0].startLine).join('\n').trim();
  if (introText.length > 500) {
    chapters.push({ id: 'intro', title: 'Introduction', text: introText, sections: [], isAssessment: false });
  }

  headings.forEach((heading, index) => {
    const endLine = headings[index + 1]?.startLine ?? lines.length;
    const chapterLines = lines.slice(heading.startLine, endLine);
    const sections = sliceSections(chapterLines, detectSections(chapterLines, heading.number));
    chapters.push({
      id: `c${heading.number}`,
      title: heading.title,
      text: chapterLines.join('\n').trim(),
      sections,
      isAssessment: isAssessmentTitle(heading.title),
    });
  });

  return chapters;
}

export function summarizeChapters(chapters) {
  return chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    charCount: chapter.text.length,
    isAssessment: chapter.isAssessment,
    sections: chapter.sections.map((section) => section.title),
  }));
}

// Older uploads were stored truncated; re-read the PDF so later chapters exist.
export async function ensureFullMaterialText(material) {
  const text = material.extracted_text || '';
  if (text.length !== LEGACY_STORED_TEXT_CHARS || !material.file_path) {
    return text;
  }

  const filePath = path.join(uploadsRoot, material.file_path);
  if (!existsSync(filePath)) {
    return text;
  }

  try {
    const fullText = await extractPdfText(filePath);
    if (fullText.length > text.length) {
      await pool.query('UPDATE materials SET extracted_text = $1, updated_at = now() WHERE id = $2', [fullText, material.id]);
      material.extracted_text = fullText;
      return fullText;
    }
  } catch {
    // keep the stored text if the file can no longer be parsed
  }

  return text;
}

export async function getMaterialChapters(material) {
  const text = await ensureFullMaterialText(material);
  return buildChapters(text);
}

function trimToSentence(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  const slice = text.slice(0, maxChars);
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'), slice.lastIndexOf('? '), slice.lastIndexOf('! '));
  return (lastStop > maxChars * 0.5 ? slice.slice(0, lastStop + 1) : slice).trim();
}

function excerptFrom(text, maxChars, rotation) {
  if (text.length <= maxChars) {
    return text;
  }
  const windows = Math.max(1, Math.ceil(text.length / maxChars));
  const start = (rotation % windows) * maxChars;
  const fromStart = text.slice(start);
  const firstBreak = start === 0 ? 0 : Math.max(0, fromStart.search(/[.?!]\s/) + 2);
  return trimToSentence(fromStart.slice(firstBreak), maxChars);
}

// "All chapters" means all teaching chapters; existing question banks and
// self-checks are only used when the teacher ticks them explicitly.
function selectChapters(chapters, chapterIds) {
  const teaching = chapters.filter((chapter) => !chapter.isAssessment);
  const fallback = teaching.length ? teaching : chapters;

  if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
    return fallback;
  }
  const wanted = new Set(chapterIds);
  const selected = chapters.filter((chapter) => wanted.has(chapter.id));
  return selected.length ? selected : fallback;
}

// Retrieval for teacher focus requests and learner explanations: keeps the
// best-matching paragraphs, in reading order.
export function retrieveRelevantExcerpts(text, query, maxChars = 3000) {
  const queryTerms = new Set(tokenize(query));
  if (!text || queryTerms.size === 0) {
    return '';
  }

  const paragraphs = text
    .split(/\n\s*\n|\n(?=\d+\.\d+\s)/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 60);

  const scored = paragraphs
    .map((paragraph, index) => {
      const words = tokenize(paragraph);
      const hits = words.filter((word) => queryTerms.has(word)).length;
      return { index, paragraph, score: words.length ? hits / Math.sqrt(words.length) : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked = [];
  let size = 0;
  for (const item of scored) {
    if (size + item.paragraph.length > maxChars) {
      continue;
    }
    picked.push(item);
    size += item.paragraph.length;
  }

  return picked.sort((a, b) => a.index - b.index).map((item) => item.paragraph).join('\n\n');
}

/**
 * scope: [{ material, chapters, chapterIds }]
 * Spreads the character budget evenly across selected chapters and sections so
 * questions cover the whole selection rather than just the opening pages.
 */
export function buildKnowledgeContext(scope, { budgetChars = 9000, rotation = 0, focus = '' } = {}) {
  const selected = scope.flatMap(({ material, chapters, chapterIds }) =>
    selectChapters(chapters, chapterIds).map((chapter) => ({ material, chapter }))
  );

  if (selected.length === 0) {
    return { text: '', fullText: '', sources: [] };
  }

  const focusBudget = focus ? Math.floor(budgetChars * 0.3) : 0;
  const totalChars = selected.reduce((sum, { chapter }) => sum + chapter.text.length, 0) || 1;
  const blocks = [];
  const sources = [];

  for (const { material, chapter } of selected) {
    const perChapter = Math.max(1000, Math.floor(((budgetChars - focusBudget) * chapter.text.length) / totalChars));
    const teachingSections = chapter.sections.filter((section) => !section.isAssessment);
    const sectionPool = chapter.isAssessment ? chapter.sections : teachingSections;
    const units = sectionPool.length ? sectionPool : [{ title: '', text: chapter.text }];
    const maxUnits = Math.max(1, Math.floor(perChapter / 500));
    const offset = units.length > maxUnits ? (rotation * maxUnits) % units.length : 0;
    const chosen = Array.from({ length: Math.min(units.length, maxUnits) }, (_, index) => units[(offset + index) % units.length]);
    const perUnit = Math.floor(perChapter / chosen.length);

    const unitText = chosen
      .map((unit) => {
        const excerpt = excerptFrom(unit.text, perUnit, rotation);
        return unit.title ? `#### ${unit.title}\n${excerpt}` : excerpt;
      })
      .join('\n\n');

    blocks.push(`### ${material.title} › ${chapter.title}\n${unitText}`);
    sources.push({
      materialId: material.id,
      materialTitle: material.title,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
    });
  }

  const fullText = selected.map(({ chapter }) => chapter.text).join('\n\n');

  if (focus) {
    const focused = retrieveRelevantExcerpts(fullText, focus, focusBudget);
    if (focused) {
      blocks.push(`### Passages most related to the teacher's request\n${focused}`);
    }
  }

  return { text: blocks.join('\n\n'), fullText, sources };
}

export function describeScope(sources) {
  const byMaterial = new Map();
  for (const source of sources) {
    const list = byMaterial.get(source.materialTitle) || [];
    list.push(source.chapterTitle);
    byMaterial.set(source.materialTitle, list);
  }
  return [...byMaterial.entries()].map(([title, chapters]) => `${title}: ${chapters.join('; ')}`).join(' | ');
}
