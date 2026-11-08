import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

export default function HomeworkMarkingPanel({ homework, onClose, onSaved }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [notice, setNotice] = useState('');
  const maxScore = Number(homework.max_score ?? homework.maxScore ?? 10);

  useEffect(() => {
    let cancelled = false;
    api.get(`/homework/${homework.id}/submissions`)
      .then(({ data }) => {
        if (!cancelled) {
          setRows((data.submissions ?? []).map((row) => ({
            ...row,
            draftScore: row.score ?? '',
            draftFeedback: row.feedback ?? '',
          })));
        }
      })
      .catch((requestError) => setError(parseApiError(requestError, 'Could not load the class list.')))
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [homework.id]);

  function updateRow(learnerId, field, value) {
    setRows((current) => current.map((row) => (row.learnerId === learnerId ? { ...row, [field]: value } : row)));
  }

  async function saveMark(row) {
    setSavingId(row.learnerId);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post(`/homework/${homework.id}/grade`, {
        learnerId: row.learnerId,
        score: Number(row.draftScore),
        feedback: row.draftFeedback,
      });
      setRows((current) => current.map((item) => (
        item.learnerId === row.learnerId
          ? {
              ...item,
              status: data.submission.status,
              score: data.submission.score,
              feedback: data.submission.feedback,
              gradedAt: data.submission.gradedAt,
              draftScore: data.submission.score,
              draftFeedback: data.submission.feedback || '',
            }
          : item
      )));
      setNotice(`Mark saved for ${row.learnerName}. Their parent has been written to.`);
      onSaved?.();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Could not save that mark.'));
    } finally {
      setSavingId('');
    }
  }

  return (
    <div className="ic-modal-backdrop">
      <div className="ic-modal space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="ic-kicker">Mark homework</p>
            <h3 className="font-scribble text-2xl text-slate-900 mt-1 tracking-wide">{homework.title}</h3>
            <p className="text-sm text-slate-500 mt-1">Out of {maxScore}. A short comment is optional, but parents do read it.</p>
          </div>
          <button type="button" onClick={onClose} className="ic-btn-ghost text-sm">Close</button>
        </div>

        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

        {loading ? (
          <p className="text-slate-500">Loading the class…</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.learnerId} className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">{row.learnerName}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    {row.score != null ? `Marked ${row.score}/${maxScore}` : row.status === 'not_submitted' ? 'Not handed in yet' : 'Handed in — awaiting a mark'}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-3">
                  <input
                    type="number"
                    min="0"
                    max={maxScore}
                    step="0.5"
                    value={row.draftScore}
                    onChange={(event) => updateRow(row.learnerId, 'draftScore', event.target.value)}
                    className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-slate-800"
                    placeholder={`0–${maxScore}`}
                  />
                  <input
                    value={row.draftFeedback}
                    onChange={(event) => updateRow(row.learnerId, 'draftFeedback', event.target.value)}
                    className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-slate-800"
                    placeholder="A kind, useful comment for the parent"
                  />
                  <button
                    type="button"
                    disabled={savingId === row.learnerId || row.draftScore === ''}
                    onClick={() => saveMark(row)}
                    className="ic-btn-primary text-sm disabled:opacity-60"
                  >
                    {savingId === row.learnerId ? 'Saving…' : 'Save mark'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
