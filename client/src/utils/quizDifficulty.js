export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Simple', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'medium', label: 'Normal', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'hard', label: 'Hard', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'extreme', label: 'Extremely hard', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
];

// Weights must match server/src/services/quizAi/systemInstructions.js.
export const DIFFICULTY_MIX_OPTIONS = [
  { value: 'balanced', label: 'Balanced mix', weights: [0.25, 0.3, 0.25, 0.2] },
  { value: 'foundation', label: 'Mostly simple & normal', weights: [0.4, 0.35, 0.15, 0.1] },
  { value: 'challenge', label: 'Challenge (more hard)', weights: [0.1, 0.25, 0.35, 0.3] },
];

export const AI_MIN_QUESTIONS = 4;
export const AI_MAX_QUESTIONS = 20;

export function difficultyOption(value) {
  return DIFFICULTY_OPTIONS.find((option) => option.value === value) ?? DIFFICULTY_OPTIONS[1];
}

export function previewDifficultyPlan(count, mix = 'balanced') {
  const weights = (DIFFICULTY_MIX_OPTIONS.find((option) => option.value === mix) ?? DIFFICULTY_MIX_OPTIONS[0]).weights;
  const total = Math.max(1, Number(count) || 1);
  const minimum = total >= DIFFICULTY_OPTIONS.length ? 1 : 0;
  const remaining = total - minimum * DIFFICULTY_OPTIONS.length;
  const raw = weights.map((weight) => weight * remaining);
  const counts = raw.map((value) => Math.floor(value) + minimum);
  let leftover = total - counts.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let index = 0; leftover > 0; index = (index + 1) % order.length) {
    counts[order[index].index] += 1;
    leftover -= 1;
  }

  return DIFFICULTY_OPTIONS.map((option, index) => ({ ...option, count: counts[index] })).filter((option) => option.count > 0);
}
