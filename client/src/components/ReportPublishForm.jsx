import { useEffect, useMemo, useState } from 'react';
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
import { parseApiError } from '../utils/errors';

const TERM_OPTIONS = ['Term 1', 'Term 2', 'Term 3', 'Term 4'];

function termDateRange(termLabel, year) {
  const safeYear = Number(year) || new Date().getFullYear();
  if (termLabel === 'Term 1') return { start: `${safeYear}-01-01`, end: `${safeYear}-03-31` };
  if (termLabel === 'Term 2') return { start: `${safeYear}-04-01`, end: `${safeYear}-06-30` };
  if (termLabel === 'Term 3') return { start: `${safeYear}-07-01`, end: `${safeYear}-09-30` };
  return { start: `${safeYear}-10-01`, end: `${safeYear}-12-31` };
}

export default function ReportPublishForm({ learners = [], onPublished }) {
  const [learnerId, setLearnerId] = useState(learners[0]?.id ?? '');
  const [periodLabel, setPeriodLabel] = useState('Term 1');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [comment, setComment] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = useMemo(() => learners.find((learner) => learner.id === learnerId), [learners, learnerId]);
  const readyToSubmit = Boolean(learnerId && file);

  useEffect(() => {
    if (!learnerId && learners[0]?.id) {
      setLearnerId(learners[0].id);
    }
  }, [learners, learnerId]);

  async function publish(event) {
    event.preventDefault();
    if (!readyToSubmit) {
      return;
    }

    const { start, end } = termDateRange(periodLabel, academicYear);
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const formData = new FormData();
      formData.append('learnerId', learnerId);
      formData.append('periodLabel', periodLabel);
      formData.append('periodStart', start);
      formData.append('periodEnd', end);
      formData.append('comment', comment);
      formData.append('publish', 'true');
      formData.append('file', file);

      const { data } = await api.post('/reports', formData);
      setNotice(`Report uploaded. ${data.notifiedParents} parent${data.notifiedParents === 1 ? '' : 's'} have been written to.`);
      setComment('');
      setFile(null);
      onPublished?.();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Could not upload the report PDF.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fk-layout fk-layout--split">
      <div className="space-y-4">
        {error ? <div className="fk-alert fk-alert--error">{error}</div> : null}
        {notice ? <div className="fk-alert fk-alert--ok">{notice}</div> : null}

        <FormCard onSubmit={publish}>
          <FormStep step={1} title="Learner and term">
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
                      {learner.first_name} {learner.last_name} - {learner.class_name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Term" required icon={FieldIcon.book}>
                <select
                  value={periodLabel}
                  onChange={(event) => setPeriodLabel(event.target.value)}
                  required
                >
                  {TERM_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Academic year" required icon={FieldIcon.calendar}>
                <input
                  type="number"
                  min="2020"
                  max="2100"
                  value={academicYear}
                  onChange={(event) => setAcademicYear(event.target.value)}
                  required
                />
              </FormField>
              <FormField label="Report PDF" required icon={FieldIcon.file} className="fk-span-2">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  required
                />
              </FormField>
            </FormGrid>
          </FormStep>

          <FormStep step={2} title="Teacher comment">
            <FormField label="Comment for the parent" icon={FieldIcon.message}>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={`A comment the parent will read, e.g. ${selected?.first_name || 'They'} has grown in confidence this term.`}
              />
            </FormField>
          </FormStep>

          <FormActions>
            <span />
            <FormSubmitButton disabled={saving || !readyToSubmit} busy={saving} busyLabel="Uploading...">
              Upload and publish
            </FormSubmitButton>
          </FormActions>
        </FormCard>
      </div>

      <aside className="fk-aside">
        <FormHelpCard
          items={[
            'Choose the learner and the school term.',
            'Upload the official PDF report for that term.',
            'Parents can view and download it on IntelliClass.',
          ]}
        />
      </aside>
    </div>
  );
}
