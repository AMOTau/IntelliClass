// Offline fallback used when the AI provider is unavailable. Builds questions
// from the selected chapters, following the same difficulty plan. Glossary
// entries give the best term/definition pairs; definition sentences in the
// body text are used when a document has no glossary.
import { tokenize } from './knowledgeBase.js';
import { similarity } from './questionValidator.js';

const GLOSSARY_TITLE = /glossary|key terms|definitions|vocabulary|terminology/i;
const WEAK_TERM_START = /^(it|they|this|that|these|those|there|here|every|each|and|but|so|one|some|all|such|which|what|who|we|you|he|she|in|on|at|for|if|when|then|also|both)\b/i;
const NOISE_SENTENCE = /\?|self-check|assessment criterion|tell this to|in grown-up terms|^(\d|figure|table|fig\.)|^[•·]|(\.\s?){3,}/i;
const GLUED_WORDS = /[a-z][A-Z][a-z]/;
const MIN_GLOSSARY_ENTRIES = 8;

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function shorten(text, max = 160) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) {
    return clean;
  }
  const clause = clean.slice(0, max).match(/^(.{60,}?)[;:—](?=\s)/);
  return clause ? clause[1].trim() : `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termPattern(term) {
  return new RegExp(`(^|[^A-Za-z-])${escapeRegExp(term)}(?=[^A-Za-z-]|$)`, 'i');
}

function overlapsTerm(a, b) {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left.includes(right) || right.includes(left);
}

function selectChapters(chapters, chapterIds) {
  const wanted = Array.isArray(chapterIds) && chapterIds.length ? new Set(chapterIds) : null;
  const picked = chapters.filter((chapter) => (wanted ? wanted.has(chapter.id) : !chapter.isAssessment));
  return picked.length ? picked : chapters.filter((chapter) => !chapter.isAssessment);
}

function cleanTerm(term) {
  return term.replace(/^(the|a|an)\s+/i, '').replace(/\s+/g, ' ').trim();
}

function isUsableTerm(term) {
  const words = term.split(/\s+/);
  return term.length >= 4 && term.length <= 50 && words.length <= 6 && !WEAK_TERM_START.test(term) && /[a-z]/i.test(term);
}

// Glossary tables often extract as "TermThe definition…" on one line.
function parseGlossary(text) {
  const entries = [];
  let current = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^term\s*definition$/i.test(line) || /^\d+\.\s/.test(line)) {
      continue;
    }

    const glued = line.match(/^([A-Z][^\n]{2,60}?(?:[a-z\d’']|\)\s?))([A-Z][a-z\s].{10,})$/);
    const colon = line.match(/^([A-Z][^:]{2,50}):\s+(.{10,})$/);
    const start = glued || colon;
    const insideBrackets = current && (current.meaning.match(/\(/g) || []).length > (current.meaning.match(/\)/g) || []).length;

    if (start && !insideBrackets && isUsableTerm(cleanTerm(start[1]))) {
      if (current) {
        entries.push(current);
      }
      current = { term: cleanTerm(start[1]), meaning: start[2].trim() };
    } else if (current) {
      current.meaning = `${current.meaning} ${line}`;
    }
  }
  if (current) {
    entries.push(current);
  }

  return entries
    .map((entry) => ({ ...entry, meaning: entry.meaning.replace(/\s+/g, ' ').trim() }))
    .filter((entry) => entry.meaning.length >= 25);
}

function sentencesFrom(units) {
  return units.flatMap(({ text, source }) =>
    text
      .replace(/\n(?!\n)/g, ' ')
      .split(/(?<=[.!])\s+(?=[A-Z“"])/)
      .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
      .filter((sentence) => sentence.length >= 50 && sentence.length <= 240)
      .filter((sentence) => !NOISE_SENTENCE.test(sentence) && !GLUED_WORDS.test(sentence))
      .map((sentence) => ({ sentence, source }))
  );
}

function definitionSentences(sentences) {
  return sentences
    .map(({ sentence, source }) => {
      const match = sentence.match(/^((?:The |An? )?[A-Z][A-Za-z’'\- ]{2,45}?)\s+(?:is|are|means|refers to)\s+((?:a|an|the|any|every)\s.{20,180})$/);
      if (!match) {
        return null;
      }
      const term = cleanTerm(match[1]);
      const vague = /\b(this|that|these|those|its|their|our|rest|part|way|thing)\b|’s\b|'s\b/i.test(term) || /^[a-z]/.test(term);
      return isUsableTerm(term) && !vague ? { term, meaning: match[2].replace(/\.$/, ''), source } : null;
    })
    .filter(Boolean);
}

function buildPool(scope) {
  const units = [];
  const glossaryEntries = [];

  for (const { material, chapters, chapterIds } of scope) {
    chapters
      .filter((chapter) => GLOSSARY_TITLE.test(chapter.title))
      .forEach((chapter) => {
        parseGlossary(chapter.text).forEach((entry) => glossaryEntries.push({ ...entry, source: `${material.title} › ${chapter.title}` }));
      });

    selectChapters(chapters, chapterIds)
      .filter((chapter) => !GLOSSARY_TITLE.test(chapter.title))
      .forEach((chapter) => {
        const sections = chapter.sections.filter((section) => !section.isAssessment);
        if (sections.length) {
          sections.forEach((section) => units.push({ text: section.text, source: `${material.title} › ${chapter.title} › ${section.title}` }));
        } else {
          units.push({ text: chapter.text, source: `${material.title} › ${chapter.title}` });
        }
      });
  }

  const sentences = sentencesFrom(units);
  const selectedText = units.map((unit) => unit.text).join('\n');
  const glossarySelected = scope.some(({ chapters, chapterIds }) =>
    selectChapters(chapters, chapterIds).some((chapter) => GLOSSARY_TITLE.test(chapter.title))
  );

  // Glossary terms stay in scope only if the selected chapters use them.
  const glossary = glossarySelected
    ? glossaryEntries
    : glossaryEntries.filter((entry) => termPattern(entry.term).test(selectedText));

  const definitions = [...glossary];
  const hasGlossary = glossaryEntries.length >= MIN_GLOSSARY_ENTRIES;
  if (!hasGlossary) {
    for (const entry of definitionSentences(sentences)) {
      if (!definitions.some((existing) => existing.term.toLowerCase() === entry.term.toLowerCase())) {
        definitions.push(entry);
      }
    }
  }

  const allDefinitions = hasGlossary
    ? [...glossaryEntries, ...definitions.filter((entry) => !glossaryEntries.includes(entry))]
    : definitions;
  const allTerms = [...new Set(allDefinitions.map((entry) => entry.term))];
  // `definitions` are question targets (in the selected chapters);
  // `allDefinitions` may also supply wrong options and supporting statements.
  return { sentences, definitions, allDefinitions, terms: allTerms };
}

// Closest-sounding terms first, so wrong options are genuinely confusable.
function rankedDistractors(terms, correct, { count = 3, close = true } = {}) {
  const others = terms.filter((term) => !overlapsTerm(term, correct));
  if (!close) {
    return shuffle(others).slice(0, count);
  }
  const correctWords = new Set(tokenize(correct));
  return others
    .map((term) => ({
      term,
      score: tokenize(term).filter((word) => correctWords.has(word)).length + Math.random() * 0.5,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((item) => item.term);
}

function definitionToTerm(pool, used, close) {
  const entry = shuffle(pool.definitions).find((item) => !used.has(`term:${item.term}`));
  if (!entry || pool.terms.length < 4) {
    return null;
  }
  used.add(`term:${entry.term}`);
  return {
    questionText: `Which term from the notes matches this description: “${shorten(entry.meaning, 200)}”?`,
    options: [entry.term, ...rankedDistractors(pool.terms, entry.term, { close })],
    correctAnswer: entry.term,
    explanation: `${entry.term}: ${shorten(entry.meaning, 240)}`,
    source: entry.source,
  };
}

function termToDefinition(pool, used) {
  if (pool.allDefinitions.length < 4) {
    return null;
  }
  const entry = shuffle(pool.definitions).find((item) => !used.has(`meaning:${item.term}`));
  if (!entry) {
    return null;
  }
  used.add(`meaning:${entry.term}`);
  const distractors = rankedDistractors(pool.allDefinitions.map((item) => item.term), entry.term)
    .map((term) => pool.allDefinitions.find((item) => item.term === term)?.meaning)
    .filter(Boolean);
  if (distractors.length < 3) {
    return null;
  }
  const correct = shorten(entry.meaning, 140);
  return {
    questionText: `According to the notes, what is meant by “${entry.term}”?`,
    options: [correct, ...distractors.map((meaning) => shorten(meaning, 140))],
    correctAnswer: correct,
    explanation: `${entry.term}: ${shorten(entry.meaning, 240)}`,
    source: entry.source,
  };
}

function clozeFromNotes(pool, used, close) {
  for (const term of shuffle(pool.terms)) {
    const pattern = termPattern(term);
    const match = pool.sentences.find((item) => !used.has(item.sentence) && pattern.test(item.sentence));
    if (!match) {
      continue;
    }
    used.add(match.sentence);
    const blanked = match.sentence.replace(pattern, (whole, lead) => `${lead}____`);
    if (blanked.toLowerCase().includes(term.toLowerCase())) {
      continue;
    }
    return {
      questionText: `Complete this statement from the notes: “${shorten(blanked, 230)}”`,
      options: [term, ...rankedDistractors(pool.terms, term, { close })],
      correctAnswer: term,
      explanation: `The notes say: ${shorten(match.sentence, 240)}`,
      source: match.source,
    };
  }
  return null;
}

function mismatchedDefinition(pool, used) {
  if (pool.allDefinitions.length < 5) {
    return null;
  }
  const target = shuffle(pool.definitions).find((item) => !used.has(`mismatch:${item.term}`));
  if (!target) {
    return null;
  }
  // The swapped-in meaning must clearly belong to a different idea, otherwise
  // the "wrong" pairing could still be true.
  const candidates = pool.allDefinitions.filter((item) =>
    !overlapsTerm(item.term, target.term) && similarity(item.meaning, target.meaning) < 0.35
  );
  const lookalike = rankedDistractors(candidates.map((item) => item.term), target.term, { count: 1 })[0];
  const wrongMeaning = candidates.find((item) => item.term === lookalike)?.meaning;
  const inScope = new Set(pool.definitions.map((item) => item.term));
  const truths = shuffle(pool.allDefinitions)
    .filter((item) => !overlapsTerm(item.term, target.term) && item.term !== lookalike)
    .sort((a, b) => Number(inScope.has(b.term)) - Number(inScope.has(a.term)))
    .slice(0, 3);
  if (!wrongMeaning || truths.length < 3) {
    return null;
  }
  used.add(`mismatch:${target.term}`);
  const falseStatement = `${target.term}: ${shorten(wrongMeaning, 120)}`;
  const named = shuffle([target.term, ...truths.map((item) => item.term)]);
  return {
    questionText: `Read carefully: which meaning is NOT correct according to the notes — ${named.slice(0, 3).join(', ')} or ${named[3]}?`,
    options: [falseStatement, ...truths.map((item) => `${item.term}: ${shorten(item.meaning, 120)}`)],
    correctAnswer: falseStatement,
    explanation: `That meaning belongs to ${lookalike}. ${target.term} actually means: ${shorten(target.meaning, 200)}`,
    source: target.source,
  };
}

export function buildLocalQuestions({ scope, plan, avoid = [] }) {
  const pool = buildPool(scope);
  const used = new Set();
  const builders = {
    easy: () => definitionToTerm(pool, used, false) || clozeFromNotes(pool, used, false),
    medium: () => (Math.random() < 0.5 ? termToDefinition(pool, used) : null) || clozeFromNotes(pool, used, false) || termToDefinition(pool, used),
    hard: () => clozeFromNotes(pool, used, true) || definitionToTerm(pool, used, true),
    extreme: () => mismatchedDefinition(pool, used) || clozeFromNotes(pool, used, true),
  };

  const questions = [];
  for (const level of plan) {
    for (let index = 0; index < level.count; index += 1) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const candidate = builders[level.key]();
        if (candidate && !avoid.some((text) => similarity(text, candidate.questionText) >= 0.9)) {
          questions.push({ ...candidate, difficulty: level.key });
          break;
        }
      }
    }
  }

  return questions;
}
