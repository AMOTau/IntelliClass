import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';
import AdminSectionCard from '../components/admin/AdminSectionCard';
import AdminSummaryChips from '../components/admin/AdminSummaryChips';
import AdminRecordsPanel from '../components/admin/AdminRecordsPanel';

export default function AdminDashboardPage() {
  const { user, signOut } = useAuthSession();
  const [activeTab, setActiveTab] = useState('learners');
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState({ learnerFamily: false, teacherAssignment: false });
  const [learnerForm, setLearnerForm] = useState({
    learnerFirstName: '',
    learnerLastName: '',
    learnerEmail: '',
    learnerPassword: '',
    classId: '',
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    parentPassword: '',
  });
  const [teacherForm, setTeacherForm] = useState({
    teacherFirstName: '',
    teacherLastName: '',
    teacherEmail: '',
    teacherPassword: '',
    classId: '',
    subjectIds: [],
  });

  async function loadAdminData() {
    setLoading(true);
    setError('');

    try {
      const [usersResponse, classesResponse, subjectsResponse] = await Promise.all([
        api.get('/users'),
        api.get('/classes'),
        api.get('/subjects'),
      ]);

      setUsers(usersResponse.data.users ?? []);
      setClasses(classesResponse.data.classes ?? []);
      setSubjects(subjectsResponse.data.subjects ?? []);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load admin data.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  const { teachers, learners, parents, counts } = useMemo(() => {
    const teachersList = users.filter((item) => item.role === 'teacher');
    const learnersList = users.filter((item) => item.role === 'learner');
    const parentsList = users.filter((item) => item.role === 'parent');

    return {
      teachers: teachersList,
      learners: learnersList,
      parents: parentsList,
      counts: {
        teachers: teachersList.length,
        learners: learnersList.length,
        parents: parentsList.length,
        classes: classes.length,
        subjects: subjects.length,
      },
    };
  }, [users, classes.length, subjects.length]);

  async function handleProvisionLearnerFamily(event) {
    event.preventDefault();
    setSaving((current) => ({ ...current, learnerFamily: true }));
    setMessage('');
    setError('');

    try {
      const { data } = await api.post('/users/provision-learner-family', learnerForm);

      setLearnerForm({
        learnerFirstName: '',
        learnerLastName: '',
        learnerEmail: '',
        learnerPassword: '',
        classId: '',
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentPassword: '',
      });

      setMessage(
        data.parentCreated
          ? 'Learner and new parent were created and linked successfully.'
          : 'Learner created and linked to the existing parent successfully.'
      );

      await loadAdminData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to provision learner and parent.'));
    } finally {
      setSaving((current) => ({ ...current, learnerFamily: false }));
    }
  }

  async function handleProvisionTeacherAssignment(event) {
    event.preventDefault();
    setSaving((current) => ({ ...current, teacherAssignment: true }));
    setMessage('');
    setError('');

    try {
      await api.post('/users/provision-teacher-assignment', teacherForm);

      setTeacherForm({
        teacherFirstName: '',
        teacherLastName: '',
        teacherEmail: '',
        teacherPassword: '',
        classId: '',
        subjectIds: [],
      });

      setMessage('Teacher created and assigned to the selected class subjects successfully.');
      await loadAdminData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to create and assign teacher.'));
    } finally {
      setSaving((current) => ({ ...current, teacherAssignment: false }));
    }
  }

  function handleLearnerFieldChange(field, value) {
    setLearnerForm((current) => ({ ...current, [field]: value }));
  }

  function handleTeacherFieldChange(field, value) {
    setTeacherForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubjectToggle(subjectId) {
    setTeacherForm((current) => {
      const isSelected = current.subjectIds.includes(subjectId);

      if (isSelected) {
        return {
          ...current,
          subjectIds: current.subjectIds.filter((item) => item !== subjectId),
        };
      }

      return {
        ...current,
        subjectIds: [...current.subjectIds, subjectId],
      };
    });
  }

  return (
    <main className="dashboard-shell admin-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>Welcome, {user?.firstName}</h1>
          <p className="lead">Provision staff, learners, parents, classes, and subjects from one place.</p>
        </div>
        <div className="dashboard-actions">
          <button type="button" className="ghost" onClick={loadAdminData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
          <button type="button" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>

      {message ? <p className="success-note">{message}</p> : null}
      {error ? <p className="error-note">{error}</p> : null}

      <section className="admin-tabs" aria-label="Admin workflows">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'learners' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('learners')}
        >
          Add Learners + Parents
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'teachers' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('teachers')}
        >
          Add Teachers + Subjects
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'records' ? 'admin-tab--active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          View Records
        </button>
      </section>

      <section className="admin-grid">
        {activeTab === 'learners' ? (
          <AdminSectionCard title="Add Learner and Link Parent" className="section-card--wide">
            <form className="admin-form" onSubmit={handleProvisionLearnerFamily}>
              <h3>Learner Details</h3>
              <div className="field-grid">
                <label>
                  First name
                  <input
                    value={learnerForm.learnerFirstName}
                    onChange={(event) => handleLearnerFieldChange('learnerFirstName', event.target.value)}
                    required
                  />
                </label>
                <label>
                  Last name
                  <input
                    value={learnerForm.learnerLastName}
                    onChange={(event) => handleLearnerFieldChange('learnerLastName', event.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="field-grid">
                <label>
                  Learner email
                  <input
                    type="email"
                    value={learnerForm.learnerEmail}
                    onChange={(event) => handleLearnerFieldChange('learnerEmail', event.target.value)}
                    required
                  />
                </label>
                <label>
                  Temporary learner password
                  <input
                    type="password"
                    minLength={8}
                    value={learnerForm.learnerPassword}
                    onChange={(event) => handleLearnerFieldChange('learnerPassword', event.target.value)}
                    required
                  />
                </label>
              </div>

              <label>
                Class
                <select
                  value={learnerForm.classId}
                  onChange={(event) => handleLearnerFieldChange('classId', event.target.value)}
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </label>

              <h3>Parent Details</h3>
              <p className="form-help">
                If the parent already exists, enter the same email and leave name/password blank. This lets one parent be linked to multiple children.
              </p>

              <div className="field-grid">
                <label>
                  Parent first name
                  <input
                    value={learnerForm.parentFirstName}
                    onChange={(event) => handleLearnerFieldChange('parentFirstName', event.target.value)}
                  />
                </label>
                <label>
                  Parent last name
                  <input
                    value={learnerForm.parentLastName}
                    onChange={(event) => handleLearnerFieldChange('parentLastName', event.target.value)}
                  />
                </label>
              </div>

              <div className="field-grid">
                <label>
                  Parent email
                  <input
                    type="email"
                    value={learnerForm.parentEmail}
                    onChange={(event) => handleLearnerFieldChange('parentEmail', event.target.value)}
                    required
                  />
                </label>
                <label>
                  Parent temporary password
                  <input
                    type="password"
                    minLength={8}
                    value={learnerForm.parentPassword}
                    onChange={(event) => handleLearnerFieldChange('parentPassword', event.target.value)}
                  />
                </label>
              </div>

              <button type="submit" disabled={saving.learnerFamily}>
                {saving.learnerFamily ? 'Saving...' : 'Add Learner and Link Parent'}
              </button>
            </form>
          </AdminSectionCard>
        ) : null}

        {activeTab === 'teachers' ? (
          <AdminSectionCard title="Add Teacher and Assign Subjects" className="section-card--wide">
            <form className="admin-form" onSubmit={handleProvisionTeacherAssignment}>
              <div className="field-grid">
                <label>
                  First name
                  <input
                    value={teacherForm.teacherFirstName}
                    onChange={(event) => handleTeacherFieldChange('teacherFirstName', event.target.value)}
                    required
                  />
                </label>
                <label>
                  Last name
                  <input
                    value={teacherForm.teacherLastName}
                    onChange={(event) => handleTeacherFieldChange('teacherLastName', event.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="field-grid">
                <label>
                  Teacher email
                  <input
                    type="email"
                    value={teacherForm.teacherEmail}
                    onChange={(event) => handleTeacherFieldChange('teacherEmail', event.target.value)}
                    required
                  />
                </label>
                <label>
                  Temporary teacher password
                  <input
                    type="password"
                    minLength={8}
                    value={teacherForm.teacherPassword}
                    onChange={(event) => handleTeacherFieldChange('teacherPassword', event.target.value)}
                    required
                  />
                </label>
              </div>

              <label>
                Class
                <select
                  value={teacherForm.classId}
                  onChange={(event) => handleTeacherFieldChange('classId', event.target.value)}
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <h3>Subjects to Teach</h3>
                <div className="subject-checkbox-grid">
                  {subjects.map((subject) => (
                    <label key={subject.id} className="subject-checkbox">
                      <input
                        type="checkbox"
                        checked={teacherForm.subjectIds.includes(subject.id)}
                        onChange={() => handleSubjectToggle(subject.id)}
                      />
                      <span>{subject.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={saving.teacherAssignment}>
                {saving.teacherAssignment ? 'Saving...' : 'Add Teacher and Assign Subjects'}
              </button>
            </form>
          </AdminSectionCard>
        ) : null}

        {activeTab === 'records' ? (
          <AdminSectionCard title="Current Records" className="section-card--wide">
            <AdminSummaryChips counts={counts} />
            <AdminRecordsPanel teachers={teachers} learners={learners} parents={parents} />
          </AdminSectionCard>
        ) : null}
      </section>
    </main>
  );
}
