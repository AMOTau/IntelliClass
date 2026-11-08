import { useState } from 'react';
import AiQuizOptions from './AiQuizOptions';

export default function AiRegeneratePanel({ currentCount, difficultyMix = 'balanced', busy, onRegenerate }) {
  const [options, setOptions] = useState({
    questionCount: currentCount || 8,
    difficultyMix,
    instructions: '',
  });
  const [mode, setMode] = useState('replace');

  function submit(nextMode) {
    if (nextMode === 'replace' && !window.confirm('Replace every question with a fresh AI set? Unsaved edits are saved first, then replaced.')) {
      return;
    }
    onRegenerate({ ...options, questionCount: Number(options.questionCount) || currentCount || 8, mode: nextMode });
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Ask the AI for changes</p>
          <p className="text-xs text-slate-500">It remembers earlier requests for this quiz and avoids repeating questions.</p>
        </div>
        <div className="flex rounded-lg border border-sky-200 bg-white p-1 text-xs font-semibold">
          {[
            ['replace', 'Replace all'],
            ['append', 'Add more'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setOptions((current) => ({ ...current, questionCount: value === 'append' ? 3 : currentCount || 8 }));
              }}
              className={`rounded-md px-3 py-1.5 ${mode === value ? 'bg-sky-500 text-white' : 'text-sky-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <AiQuizOptions
        value={options}
        onChange={setOptions}
        minQuestions={mode === 'append' ? 1 : 4}
        countLabel={mode === 'append' ? 'Questions to add' : 'Number of questions'}
        disabled={busy}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => submit(mode)}
        className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? 'Generating with AI…' : mode === 'append' ? 'Add questions with AI' : 'Regenerate all questions'}
      </button>
    </div>
  );
}
