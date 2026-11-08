import { useMemo, useState } from 'react';

const OPTION_COLORS = [
  'border-teal-300 bg-teal-50 hover:bg-teal-100',
  'border-sky-300 bg-sky-50 hover:bg-sky-100',
  'border-cyan-300 bg-cyan-50 hover:bg-cyan-100',
  'border-emerald-300 bg-emerald-50 hover:bg-emerald-100',
];

function ClassicPlay({ questions, answers, setAnswers }) {
  return (
    <div className="space-y-5">
      {questions.map((question, index) => (
        <section key={question.id} className="ic-panel">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Question {index + 1}</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">{question.questionText}</h2>
          <div className="mt-4 space-y-3">
            {(question.options || []).map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm text-slate-700 transition ${
                  answers[question.id] === option ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200' : 'border-teal-100 hover:border-teal-300'
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={answers[question.id] === option}
                  onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TapMatchPlay({ questions, answers, setAnswers }) {
  return (
    <div className="space-y-6">
      {questions.map((question, index) => (
        <section key={question.id} className="rounded-3xl border-2 border-dashed border-teal-200 bg-gradient-to-br from-white to-teal-50/60 p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">{index + 1}</span>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-600">Tap the best answer</p>
          </div>
          <h2 className="mt-3 text-lg font-bold text-slate-800">{question.questionText}</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(question.options || []).map((option, optionIndex) => {
              const selected = answers[question.id] === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                  className={`rounded-2xl border-2 px-4 py-4 text-left text-sm font-semibold text-slate-700 transition transform hover:-translate-y-0.5 ${
                    OPTION_COLORS[optionIndex % OPTION_COLORS.length]
                  } ${selected ? 'ring-4 ring-teal-300 scale-[1.02]' : ''}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function DragDropPlay({ questions, answers, setAnswers }) {
  const [dragging, setDragging] = useState(null);

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        Drag an answer chip into the drop zone under each question — or tap a chip to place it.
      </p>
      {questions.map((question, index) => (
        <section key={question.id} className="rounded-3xl border border-teal-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-600">Quest {index + 1}</p>
          <h2 className="mt-2 text-lg font-bold text-slate-800">{question.questionText}</h2>

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const option = event.dataTransfer.getData('text/plain') || dragging;
              if (option) {
                setAnswers((current) => ({ ...current, [question.id]: option }));
              }
              setDragging(null);
            }}
            className={`mt-4 min-h-16 rounded-2xl border-2 border-dashed px-4 py-5 text-center text-sm font-semibold transition ${
              answers[question.id]
                ? 'border-teal-400 bg-teal-50 text-teal-800'
                : 'border-slate-300 bg-slate-50 text-slate-400'
            }`}
          >
            {answers[question.id] || 'Drop your answer here'}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(question.options || []).map((option) => (
              <button
                key={option}
                type="button"
                draggable
                onDragStart={(event) => {
                  setDragging(option);
                  event.dataTransfer.setData('text/plain', option);
                }}
                onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                className={`cursor-grab rounded-full border px-4 py-2 text-sm font-semibold text-slate-700 active:cursor-grabbing ${
                  answers[question.id] === option
                    ? 'border-teal-500 bg-teal-100'
                    : 'border-teal-200 bg-gradient-to-r from-teal-50 to-sky-50 hover:border-teal-400'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AdventurePlay({ questions, answers, setAnswers }) {
  const answeredCount = useMemo(
    () => questions.filter((question) => Boolean(answers[question.id])).length,
    [questions, answers]
  );
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#1f5c4d] bg-[#1f5c4d] p-5 text-[#f7f3ea] shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#d7efe6]">Adventure mode</p>
            <p className="font-scribble text-xl tracking-wide">Collect stars by answering each challenge</p>
          </div>
          <div className="text-3xl" aria-hidden="true">{'⭐'.repeat(Math.max(1, Math.min(5, answeredCount)))}</div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-[#f7f3ea] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-[#d7efe6]">{answeredCount} / {questions.length} challenges complete</p>
      </div>

      {questions.map((question, index) => (
        <section key={question.id} className="rounded-3xl border border-teal-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-600">Challenge {index + 1}</p>
            <span className="text-xl">{answers[question.id] ? '⭐' : '☆'}</span>
          </div>
          <h2 className="mt-2 text-lg font-bold text-slate-800">{question.questionText}</h2>
          <div className="mt-4 space-y-3">
            {(question.options || []).map((option, optionIndex) => (
              <button
                key={option}
                type="button"
                onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition ${
                  OPTION_COLORS[optionIndex % OPTION_COLORS.length]
                } ${answers[question.id] === option ? 'ring-4 ring-amber-200 scale-[1.01]' : ''}`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function LearnerQuizPlay({ template = 'classic', questions, answers, setAnswers }) {
  if (template === 'drag_drop') {
    return <DragDropPlay questions={questions} answers={answers} setAnswers={setAnswers} />;
  }
  if (template === 'tap_match') {
    return <TapMatchPlay questions={questions} answers={answers} setAnswers={setAnswers} />;
  }
  if (template === 'adventure') {
    return <AdventurePlay questions={questions} answers={answers} setAnswers={setAnswers} />;
  }
  return <ClassicPlay questions={questions} answers={answers} setAnswers={setAnswers} />;
}

export const LEARNER_TEMPLATE_OPTIONS = [
  { value: 'classic', label: 'Classic multiple choice', hint: 'Simple radio buttons for learners.' },
  { value: 'drag_drop', label: 'Drag & drop', hint: 'Learners drag answer chips into a drop zone.' },
  { value: 'tap_match', label: 'Colour tap cards', hint: 'Big colourful answer tiles to tap.' },
  { value: 'adventure', label: 'Adventure stars', hint: 'Progress bar and stars for each answer.' },
];
