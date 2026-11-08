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
import { parseApiError } from '../utils/errors';

export default function ParentMessageForm({ classes = [], learners = [], onSent }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [learnerId, setLearnerId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const classLearners = useMemo(
    () => learners.filter((learner) => !classId || learner.class_id === classId || learner.classId === classId),
    [learners, classId]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post('/messages', {
        classId: learnerId ? undefined : classId,
        learnerId: learnerId || undefined,
        title,
        body,
      });
      setTitle('');
      setBody('');
      setNotice(data.message || 'Message sent.');
      onSent?.();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Could not send that message.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fk-layout fk-layout--split">
      <FormCard onSubmit={handleSubmit}>
        {error ? <div className="fk-alert fk-alert--error">{error}</div> : null}
        {notice ? <div className="fk-alert fk-alert--ok">{notice}</div> : null}

        <FormStep step={1} title="Who should receive this">
          <FormGrid>
            <FormField label="Class" required={!learnerId} icon={FieldIcon.school}>
              <select
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setLearnerId('');
                }}
                required={!learnerId}
              >
                <option value="">Whole class…</option>
                {classes.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Specific learner" icon={FieldIcon.person}>
              <select
                value={learnerId}
                onChange={(event) => setLearnerId(event.target.value)}
              >
                <option value="">All parents in this class</option>
                {classLearners.map((learner) => (
                  <option key={learner.id} value={learner.id}>
                    {learner.first_name} {learner.last_name}
                  </option>
                ))}
              </select>
            </FormField>
          </FormGrid>
        </FormStep>

        <FormStep step={2} title="Write the note">
          <FormGrid cols={1}>
            <FormField label="Subject" required icon={FieldIcon.message}>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Please sit with Thabo on tonight’s revision"
                required
                maxLength={160}
              />
            </FormField>
            <FormField label="Message" required icon={FieldIcon.message}>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write as you would speak to the parent. They will see this as an IntelliClass alert."
                required
                maxLength={4000}
              />
            </FormField>
          </FormGrid>
        </FormStep>

        <FormActions>
          <span />
          <FormSubmitButton disabled={saving} busyLabel="Sending…">
            {learnerId ? 'Send to this parent' : 'Send to the class parents'}
          </FormSubmitButton>
        </FormActions>
      </FormCard>

      <aside className="fk-aside">
        <FormHelpCard
          items={[
            'Parents see this as an IntelliClass alert.',
            'Choose a learner to write to one family only.',
            'Add your phone number on your profile so parents can call you.',
          ]}
        />
      </aside>
    </div>
  );
}
