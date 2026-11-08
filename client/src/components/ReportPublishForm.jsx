import { useMemo, useState } from 'react';
import {
  FieldIcon,
  FormActions,
  FormCard,
  FormField,
  FormGrid,
  FormHelpCard,
  FormStep,
  FormSubmitButton,
} from './ui/FormKit';
import { api } from '../lib/api';
import { monthsAgoInputValue, todayInputValue } from '../utils/dates';
import { parseApiError } from '../utils/errors';

export default function ReportPublishForm({ learners = [], onPublished }) {
  const [learnerId, setLearnerId] = useState(learners[0]?.id ?? '');
  const [periodLabel, setPeriodLabel] = useState('Term 1');
  const [periodStart, setPeriodStart] = useState(monthsAgoInputValue(3));
  const [periodEnd, setPeriodEnd] = useState(todayInputValue());
  const [comment, setComment] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = useMemo(() => learners.find((learner) => learner.id === learnerId), [learners, learnerId]);

  async function loadPreview(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.get('/reports/preview', {
        params: { learnerId, periodStart, periodEnd },
      });
      setPreview(data.summary);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Could not build the preview.'));
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post('/reports', {
        learnerId,
        periodStart,
        periodEnd,
        periodLabel,
        comment,
        publish: true,
      });
      setNotice(`Report published. ${data.notifiedParents} parent${data.notifiedParents === 1 ? '' : 's'} have been written to.`);
      setPreview(null);
      setComment('');
      onPublished?.();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Could not publish the report.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fk-layout fk-layout--split">
      <div className="space-y-4">
        {error ? <div className="fk-alert fk-alert--error">{error}</div> : null}
        {notice ? <div className="fk-alert fk-alert--ok">{notice}</div> : null}

        <FormCard onSubmit={loadPreview}>
          <FormStep step={1} title="Learner & period">
            <FormGrid>
              <FormField label="Learner" required icon={FieldIcon.person} className="fk-span-2">
                <select
                  value={learnerId}
                  onChange={(event) => setLearnerId(event.target.value)}
                  required
                >
                  <option value="">Select learner</option>
                  {learners.map((learner) => (
                    <option key={learner.id} value={learner.id}>
                      {learner.first_name} {learner.last_name} · {learner.class_name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Period label" required icon={FieldIcon.book} className="fk-span-2">
                <input
                  value={periodLabel}
                  onChange={(event) => setPeriodLabel(event.target.value)}
                  placeholder="e.g. Term 1 or First quarter"
                  required
                />
              </FormField>
              <FormField label="Period start" required icon={FieldIcon.calendar}>
                <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required />
              </FormField>
              <FormField label="Period end" required icon={FieldIcon.calendar}>
                <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required />
              </FormField>
            </FormGrid>
          </FormStep>

          <FormStep step={2} title="Teacher comment">
            <FormField label="Comment for the parent" icon={FieldIcon.message}>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={`A comment the parent will read, e.g. “${selected?.first_name || 'They'} has grown in confidence this term.”`}
              />
            </FormField>
          </FormStep>

          <FormActions>
            <FormSubmitButton disabled={saving} busyLabel="Working…">
              Preview numbers
            </FormSubmitButton>
            <button
              type="button"
              disabled={saving || !preview}
              onClick={publish}
              className="fk-btn fk-btn--primary disabled:opacity-60"
            >
              Publish to parents
            </button>
          </FormActions>
        </FormCard>

        {preview ? (
          <div className="ic-note-chip space-y-2">
            <p>
              Quizzes: {preview.quizzes.attempts} written, average {preview.quizzes.average ?? '—'}%.
              Homework: {preview.homework.completed}/{preview.homework.assigned} done
              {preview.homework.average != null ? `, average ${preview.homework.average}%` : ''}.
            </p>
            {preview.topics.weaknesses?.[0] ? (
              <p>Needs support on: {preview.topics.weaknesses.map((item) => item.topic).slice(0, 3).join(', ')}.</p>
            ) : (
              <p>Not enough quiz answers yet to name a weak topic. The snapshot will still go to the parent.</p>
            )}
          </div>
        ) : null}
      </div>

      <aside className="fk-aside">
        <FormHelpCard
          items={[
            'Preview the numbers before you publish.',
            'Published snapshots do not change later.',
            'Parents will see the report on IntelliClass.',
          ]}
        />
      </aside>
    </div>
  );
}
