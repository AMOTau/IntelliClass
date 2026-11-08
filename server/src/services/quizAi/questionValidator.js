import { tokenize } from './knowledgeBase.js';

const DIFFICULTY_ALIASES = {
  easy: 'easy', simple: 'easy', basic: 'easy', recall: 'easy',
  medium: 'medium', normal: 'medium', moderate: 'medium', intermediate: 'medium',
  hard: 'hard', difficult: 'hard', challenging: 'hard', application: 'hard',
  extreme: 'extreme', 'extremely hard': 'extreme', 'very hard': 'extreme', expert: 'extreme', advanced: 'extreme',
};

const BANNED_OPTIONS = /^(all|none|both|neither) of (the )?(above|these|them)$|^(both|all) (a|b|c|d)( and (a|b|c|d))+$/i;
const QUESTION_STARTERS = /^(which|what|why|how|when|where|who|whom|whose|according|in the notes|choose|select|identify|complete|fill|name|a |an |the |if |suppose|imagine)/i;
const HEADING_LIKE = /^(\d+(\.\d+)*\.?\s|chapter\s|unit\s|section\s)|(\.\s?){4,}/i;

export function canonicalDifficulty(value) {
  const key = String(value || '').trim().toLowerCase();
  return DIFFICULTY_ALIASES[key] || 'medium';
}

function stripOptionLabel(option) {
  return String(option ?? '')
    .replace(/^\s*(?:\(?[a-dA-D]\)|[a-dA-D][.:]|option\s+[a-dA-D][.:)]?)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readOptions(raw) {
  if (Array.isArray(raw)) {
    return raw.map((option) => (typeof option === 'object' && option ? option.text ?? option.option ?? '' : option));
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw);
  }
  return [];
}

function resolveCorrect(correctRaw, options) {
  const correct = stripOptionLabel(correctRaw);
  const exact = options.find((option) => option.toLowerCase() === correct.toLowerCase());
  if (exact) {
    return exact;
  }

  const letter = String(correctRaw ?? '').trim().match(/^(?:option\s+)?\(?([a-dA-D])\)?[.:)]?$/);
  if (letter) {
    return options['abcd'.indexOf(letter[1].toLowerCase())];
  }

  const index = Number(correctRaw);
  if (Number.isInteger(index) && index >= 0 && index < options.length) {
    return options[index];
  }

  return options.find((option) => option.toLowerCase().includes(correct.toLowerCase()) && correct.length > 3);
}

function wordSet(text) {
  return new Set(tokenize(text));
}

export function similarity(a, b) {
  const left = wordSet(a);
  const right = wordSet(b);
  if (!left.size || !right.size) {
    return 0;
  }
  let shared = 0;
  left.forEach((word) => {
    if (right.has(word)) {
      shared += 1;
    }
  });
  return shared / Math.min(left.size, right.size);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function normalizeQuestionText(text) {
  let value = String(text ?? '').replace(/\s+/g, ' ').trim().replace(/^(q(uestion)?\s*\d+[:.)]\s*)/i, '');
  if (value && !/[?]$/.test(value) && !value.includes('____') && QUESTION_STARTERS.test(value) && !/[.!:]$/.test(value)) {
    value = `${value}?`;
  }
  return value;
}

/**
 * Checks AI output before it reaches the teacher. Returns usable questions and
 * plain-language reasons for anything rejected (fed back to the model).
 */
export function validateGeneratedQuestions(rawQuestions, { knowledgeText = '', avoid = [] } = {}) {
  const knowledgeWords = new Set(tokenize(knowledgeText));
  const accepted = [];
  const problems = [];

  (Array.isArray(rawQuestions) ? rawQuestions : []).forEach((item, index) => {
    const label = `Question ${index + 1}`;
    const questionText = normalizeQuestionText(item?.questionText ?? item?.question ?? item?.prompt);

    if (questionText.length < 15) {
      problems.push(`${label} was too short or empty.`);
      return;
    }
    if (HEADING_LIKE.test(questionText)) {
      problems.push(`${label} ("${questionText.slice(0, 60)}") looked like a heading, not a question.`);
      return;
    }
    if (!questionText.includes('?') && !questionText.includes('____')) {
      problems.push(`${label} ("${questionText.slice(0, 60)}") is a topic or statement, not a question.`);
      return;
    }

    const options = [...new Map(
      readOptions(item?.options ?? item?.choices ?? item?.answers)
        .map(stripOptionLabel)
        .filter(Boolean)
        .map((option) => [option.toLowerCase(), option])
    ).values()];

    if (options.some((option) => BANNED_OPTIONS.test(option))) {
      problems.push(`${label} used "all/none of the above" style options.`);
      return;
    }

    const correct = resolveCorrect(item?.correctAnswer ?? item?.correct_answer ?? item?.answer, options);
    if (!correct) {
      problems.push(`${label} had a correctAnswer that does not match any option.`);
      return;
    }

    const distractors = options.filter((option) => option !== correct);
    if (distractors.length < 3) {
      problems.push(`${label} needs exactly 4 different options (it had ${options.length}).`);
      return;
    }

    if (knowledgeWords.size) {
      const contentWords = tokenize(`${questionText} ${correct}`).filter((word) => word.length >= 5);
      const grounded = contentWords.filter((word) => knowledgeWords.has(word)).length;
      if (contentWords.length >= 3 && grounded === 0) {
        problems.push(`${label} ("${questionText.slice(0, 60)}") is not about the knowledge base content.`);
        return;
      }
    }

    const duplicate = [...avoid, ...accepted.map((question) => question.questionText)]
      .some((existing) => similarity(existing, questionText) >= 0.8);
    if (duplicate) {
      problems.push(`${label} repeated an existing question.`);
      return;
    }

    accepted.push({
      questionText,
      options: shuffle([correct, ...distractors.slice(0, 3)]),
      correctAnswer: correct,
      explanation: String(item?.explanation ?? '').trim() || null,
      difficulty: canonicalDifficulty(item?.difficulty),
      topic: String(item?.source ?? item?.topic ?? '').trim().slice(0, 160) || null,
    });
  });

  return { accepted, problems };
}

export function missingPlan(plan, accepted) {
  const have = accepted.reduce((counts, question) => ({ ...counts, [question.difficulty]: (counts[question.difficulty] || 0) + 1 }), {});
  return plan
    .map((level) => ({ ...level, count: Math.max(0, level.count - (have[level.key] || 0)) }))
    .filter((level) => level.count > 0);
}

// Keeps the planned difficulty spread when the model returns extra questions
// for one level.
export function fitToPlan(plan, questions, total) {
  const buckets = new Map(plan.map((level) => [level.key, []]));
  const overflow = [];
  for (const question of questions) {
    const bucket = buckets.get(question.difficulty);
    const level = plan.find((item) => item.key === question.difficulty);
    if (bucket && level && bucket.length < level.count) {
      bucket.push(question);
    } else {
      overflow.push(question);
    }
  }
  const picked = plan.flatMap((level) => buckets.get(level.key));
  return [...picked, ...overflow].slice(0, total);
}
