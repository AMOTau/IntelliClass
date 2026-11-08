import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';
import DifficultyBadge from './DifficultyBadge';

const MODE_LABELS = {
  create: 'Created quiz',
  replace: 'Regenerated all',
  append: 'Added questions',
};

export default function AiHistoryPanel({ quizId, refreshKey }) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState('');

  useEffect(() => {
    if (!quizId) {
      return;
    }
    api.get(`/ai/quiz-history/${quizId}`)
      .then(({ data }) => {
        setHistory(data.history ?? []);
        setError('');
      })
      .catch((requestError) => setError(parseApiError(requestError, 'Could not load AI history.')));
  }, [quizId, refreshKey]);

  const exchanges = [];
  for (let index = 0; index < history.length; index += 1) {
    if (history[index].role === 'teacher') {
      const reply = history[index + 1]?.role === 'assistant' ? history[index + 1] : null;
      exchanges.push({ request: history[index], reply });
      if (reply) {
        index += 1;
      }
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-semibold text-slate-800">AI history for this quiz ({exchanges.length})</span>
        <span className="text-xs font-semibold text-teal-700">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open ? (
        <div className="space-y-3">
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          {exchanges.length === 0 && !error ? <p className="text-xs text-slate-500">No AI requests yet.</p> : null}
          {exchanges.map(({ request, reply }) => (
            <div key={request.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">{MODE_LABELS[request.mode] || 'Request'}</span>
                <span className="text-xs text-slate-400">{new Date(request.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-slate-700">“{request.content}”</p>
              {request.scopeDescription ? <p className="text-xs text-slate-500">Content: {request.scopeDescription}</p> : null}
              {reply ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">
                    {reply.content}
                    {reply.questions.length ? (
                      <button
                        type="button"
                        className="ml-2 font-semibold text-teal-700"
                        onClick={() => setExpanded((current) => (current === reply.id ? '' : reply.id))}
                      >
                        {expanded === reply.id ? 'Hide questions' : 'View questions'}
                      </button>
                    ) : null}
                  </p>
                  {reply.warning ? <p className="text-xs text-amber-700">{reply.warning}</p> : null}
                  {expanded === reply.id ? (
                    <ul className="space-y-1.5">
                      {reply.questions.map((question, index) => (
                        <li key={`${reply.id}-${index}`} className="flex items-start gap-2 text-xs text-slate-700">
                          <DifficultyBadge value={question.difficulty} />
                          <span>{question.questionText}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
