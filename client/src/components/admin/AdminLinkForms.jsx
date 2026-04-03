export default function AdminLinkForms({
  form,
  classes,
  learners,
  parents,
  teachers,
  subjects,
  onFieldChange,
  onParentLearnerSubmit,
  onLearnerClassSubmit,
  onTeacherClassSubjectSubmit,
  loading,
}) {
  return (
    <>
      <form className="admin-form" onSubmit={onParentLearnerSubmit}>
        <div className="field-grid">
          <label>
            Parent
            <select value={form.parentId} onChange={(event) => onFieldChange('parentId', event.target.value)} required>
              <option value="">Select parent</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.firstName} {parent.lastName} ({parent.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            Learner
            <select value={form.learnerId} onChange={(event) => onFieldChange('learnerId', event.target.value)} required>
              <option value="">Select learner</option>
              {learners.map((learner) => (
                <option key={learner.id} value={learner.id}>
                  {learner.firstName} {learner.lastName} ({learner.email})
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" disabled={loading.link}>
          {loading.link ? 'Linking...' : 'Link Parent and Learner'}
        </button>
      </form>

      <form className="admin-form" onSubmit={onLearnerClassSubmit}>
        <div className="field-grid">
          <label>
            Learner
            <select value={form.learnerId} onChange={(event) => onFieldChange('learnerId', event.target.value)} required>
              <option value="">Select learner</option>
              {learners.map((learner) => (
                <option key={learner.id} value={learner.id}>
                  {learner.firstName} {learner.lastName} ({learner.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            Class
            <select value={form.classId} onChange={(event) => onFieldChange('classId', event.target.value)} required>
              <option value="">Select class</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name} {classItem.grade_level ? `- ${classItem.grade_level}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" disabled={loading.link}>
          {loading.link ? 'Linking...' : 'Link Learner to Class'}
        </button>
      </form>

      <form className="admin-form" onSubmit={onTeacherClassSubjectSubmit}>
        <div className="field-grid">
          <label>
            Teacher
            <select value={form.teacherId} onChange={(event) => onFieldChange('teacherId', event.target.value)} required>
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName} ({teacher.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            Class
            <select value={form.classId} onChange={(event) => onFieldChange('classId', event.target.value)} required>
              <option value="">Select class</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name} {classItem.grade_level ? `- ${classItem.grade_level}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Subject
          <select value={form.subjectId} onChange={(event) => onFieldChange('subjectId', event.target.value)} required>
            <option value="">Select subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} {subject.code ? `(${subject.code})` : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading.link}>
          {loading.link ? 'Linking...' : 'Link Teacher to Class and Subject'}
        </button>
      </form>
    </>
  );
}
