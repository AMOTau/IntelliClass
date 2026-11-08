// Layer 1 — system instruction.
// Defines what a good quiz question is, the difficulty ladder, and the shape
// each learner template needs.

export const DIFFICULTY_LEVELS = [
  {
    key: 'easy',
    label: 'Simple',
    guide: 'Recall: a fact, definition, name or example that is stated clearly in the notes.',
  },
  {
    key: 'medium',
    label: 'Normal',
    guide: 'Understanding: explain, compare or recognise an idea from the notes when it is worded differently.',
  },
  {
    key: 'hard',
    label: 'Hard',
    guide: 'Application: apply a rule, method or idea from the notes to a short new situation. The learner must reason, not just remember.',
  },
  {
    key: 'extreme',
    label: 'Extremely hard',
    guide: 'Analysis: combine two or more ideas from the notes, spot a subtle difference or a common misconception, or reason through several steps. The wrong options must be very close to the truth.',
  },
];

export const DIFFICULTY_MIXES = {
  balanced: [0.25, 0.3, 0.25, 0.2],
  foundation: [0.4, 0.35, 0.15, 0.1],
  challenge: [0.1, 0.25, 0.35, 0.3],
};

export function normalizeDifficultyMix(value) {
  const key = String(value || 'balanced').trim().toLowerCase();
  return DIFFICULTY_MIXES[key] ? key : 'balanced';
}

// Largest-remainder split; every level gets at least one question when count >= 4.
export function buildDifficultyPlan(count, mix = 'balanced') {
  const weights = DIFFICULTY_MIXES[normalizeDifficultyMix(mix)];
  const total = Math.max(1, Number(count) || 1);
  const minimum = total >= DIFFICULTY_LEVELS.length ? 1 : 0;
  const remainingAfterMinimum = total - minimum * DIFFICULTY_LEVELS.length;

  const raw = weights.map((weight) => weight * remainingAfterMinimum);
  const counts = raw.map((value) => Math.floor(value) + minimum);
  let leftover = total - counts.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let index = 0; leftover > 0; index = (index + 1) % order.length) {
    counts[order[index].index] += 1;
    leftover -= 1;
  }

  return DIFFICULTY_LEVELS.map((level, index) => ({ ...level, count: counts[index] })).filter((level) => level.count > 0);
}

const TEMPLATE_GUIDES = {
  classic: [
    'Format: classic multiple choice.',
    '- questionText is a complete question ending with "?".',
    '- Each option is a short phrase or one short sentence (at most about 15 words).',
  ],
  drag_drop: [
    'Format: drag & drop. Learners drag one answer chip into a blank.',
    '- Write questionText as a sentence containing exactly one blank "____" where the answer belongs, e.g. "A problem that no algorithm can solve for every input is called ____."',
    '- Options are SHORT chips of 1–5 words, all the same kind of thing (all terms, or all numbers, or all names) so each one could grammatically fill the blank.',
  ],
  tap_match: [
    'Format: colour tap cards. Learners tap one of four big tiles.',
    '- questionText is a clear question ending with "?".',
    '- Options are short (at most 8 words) and written in the same grammatical form so none stands out.',
  ],
  adventure: [
    'Format: adventure challenges.',
    '- Start questionText with one short story set-up sentence that uses a scenario, example or analogy from the notes, then ask the question, ending with "?".',
    '- Options are at most about 12 words.',
  ],
};

export function buildSystemInstruction({ learnerTemplate = 'classic', className = '', subjectName = '' } = {}) {
  const template = TEMPLATE_GUIDES[learnerTemplate] ? learnerTemplate : 'classic';

  return [
    'You are an experienced teacher and assessment designer. You write quiz questions that test what a study document actually teaches.',
    '',
    'KNOWLEDGE BASE RULE',
    '- The teacher gives you a KNOWLEDGE BASE built from their uploaded study material. It is your source of truth.',
    '- Every question and every correct answer must be answerable from the knowledge base alone.',
    '- Prefer the explanations, definitions, examples and wording of the knowledge base over anything you know from elsewhere. If general knowledge disagrees with the notes, follow the notes.',
    '- Do not invent facts, names, numbers or examples that are not in the knowledge base.',
    '',
    'WHAT A QUESTION IS',
    '- A question asks the learner something that has exactly one correct answer. A topic, heading or chapter title is NOT a question.',
    '- Bad (a topic): "Rice’s theorem" or "Program equivalence overview".',
    '- Good: "According to the notes, why can no tool decide program equivalence for every pair of programs?"',
    '- Ignore tables of contents, page numbers, headings lists and "self-check" numbering. Ask about the ideas taught in the paragraphs.',
    '- One idea per question. No trick wording. No double negatives.',
    '',
    'ANSWER OPTIONS',
    '- Exactly 4 options per question and exactly 1 of them correct.',
    '- The 3 wrong options are there to make the learner think: use related terms from the notes, common misconceptions, or ideas from a different section that sound right but do not answer this question.',
    '- All 4 options are similar in length, tone and grammar. The correct option must not be the longest one by habit.',
    '- Never use "All of the above", "None of the above", "Both A and B" or joke options.',
    '- correctAnswer must be copied character for character from one of the options.',
    '',
    'DIFFICULTY LADDER',
    ...DIFFICULTY_LEVELS.map((level) => `- ${level.key} (${level.label}): ${level.guide}`),
    '',
    ...TEMPLATE_GUIDES[template],
    '',
    'LANGUAGE',
    `- The learners are in ${className || 'the class'}${subjectName ? ` studying ${subjectName}` : ''}. Use clear words suited to them while keeping the content accurate to the notes.`,
    '',
    'EXPLANATIONS AND SOURCES',
    '- explanation: one short sentence saying why the correct answer is right, using the notes.',
    '- source: chapter/section heading from the knowledge base.',
    '',
    'OUTPUT',
    '- Reply with JSON only, no markdown, no commentary:',
    '{"questions":[{"questionText":"...","options":["...","...","...","..."],"correctAnswer":"...","explanation":"...","difficulty":"easy|medium|hard|extreme","source":"..."}]}',
  ].join('\n');
}

export function buildKnowledgeMessage({ knowledgeText, scopeDescription }) {
  return [
    'KNOWLEDGE BASE — study material selected by the teacher.',
    scopeDescription ? `Selected content: ${scopeDescription}` : '',
    'Use only this material for questions and answers.',
    '',
    '<<<KNOWLEDGE_BASE',
    knowledgeText,
    'KNOWLEDGE_BASE>>>',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function buildGenerationRequest({ count, plan, instructions = '', avoidQuestions = [], mode = 'replace' }) {
  const planText = plan.map((level) => `${level.count} × ${level.key} (${level.label})`).join(', ');
  const avoid = avoidQuestions.slice(-20);

  return [
    mode === 'append'
      ? `Write ${count} MORE multiple-choice questions to add to this quiz.`
      : `Write exactly ${count} multiple-choice questions for this quiz.`,
    `Difficulty plan (follow it exactly): ${planText}.`,
    'Spread the questions across the different chapters and sections in the knowledge base instead of asking several questions about the same paragraph.',
    instructions ? `Teacher instructions (follow them as long as they stay within the knowledge base): ${instructions}` : '',
    avoid.length
      ? `These questions already exist. Do not repeat them or ask the same thing in different words:\n${avoid.map((text) => `- ${text}`).join('\n')}`
      : '',
    'Reply with the JSON object only.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildRepairRequest({ missingPlan, problems }) {
  const planText = missingPlan.map((level) => `${level.count} × ${level.key}`).join(', ');
  return [
    'Some of your questions could not be used:',
    ...problems.slice(0, 8).map((problem) => `- ${problem}`),
    `Write ${missingPlan.reduce((sum, level) => sum + level.count, 0)} replacement questions: ${planText}.`,
    'Each must be a real question (not a topic), have exactly 4 different options with exactly one correct, and come from the knowledge base.',
    'Reply with the JSON object only.',
  ].join('\n');
}
