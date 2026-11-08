import { AI_MAX_QUESTIONS, DIFFICULTY_MIX_OPTIONS, previewDifficultyPlan } from '../utils/quizDifficulty';

/**
 * value: { questionCount, difficultyMix, instructions }
 */
export default function AiQuizOptions({ value, onChange, minQuestions = 4, countLabel = 'Number of questions', disabled = false }) {
  const plan = previewDifficultyPlan(value.questionCount, value.difficultyMix);

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-slate-700 space-y-1">
          <span className="font-semibold text-slate-800">{countLabel}</span>
          <input
            type="number"
            min={minQuestions}
            max={AI_MAX_QUESTIONS}
            disabled={disabled}
            value={value.questionCount}
            onChange={(event) => onChange({ ...value, questionCount: event.target.value })}
            className="w-full rounded-lg border border-teal-200 bg-white px-4 py-2.5 text-slate-800"
          />
        </label>
        <label className="text-sm text-slate-700 space-y-1">
          <span className="font-semibold text-slate-800">Difficulty mix</span>
          <select
            value={value.difficultyMix}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, difficultyMix: event.target.value })}
            className="w-full rounded-lg border border-teal-200 bg-white px-4 py-2.5 text-slate-800"
          >
            {DIFFICULTY_MIX_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {plan.map((level) => (
          <span key={level.value} className={`rounded-full border px-3 py-1 font-semibold ${level.badge}`}>
            {level.count} × {level.label}
          </span>
        ))}
      </div>

      <label className="block text-sm text-slate-700 space-y-1">
        <span className="font-semibold text-slate-800">Instructions for the AI (optional)</span>
        <textarea
          rows={3}
          maxLength={1500}
          disabled={disabled}
          value={value.instructions}
          onChange={(event) => onChange({ ...value, instructions: event.target.value })}
          placeholder="e.g. Focus on the worked examples in section 2.4, and include two scenario questions about software testing."
          className="w-full rounded-lg border border-teal-200 bg-white px-4 py-2.5 text-slate-800"
        />
      </label>
    </div>
  );
}
