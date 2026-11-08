import { difficultyOption } from '../utils/quizDifficulty';

export default function DifficultyBadge({ value }) {
  const option = difficultyOption(value);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${option.badge}`}>
      {option.label}
    </span>
  );
}
