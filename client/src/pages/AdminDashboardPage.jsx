import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';
import AdminSectionCard from '../components/admin/AdminSectionCard';
import AdminSummaryChips from '../components/admin/AdminSummaryChips';
import AdminRecordsPanel from '../components/admin/AdminRecordsPanel';

/*
  NOTE
  ----
  This file only restyles markup that lives directly in
  AdminDashboardPage.jsx. AdminSectionCard, AdminSummaryChips, and
  AdminRecordsPanel are still imported and used exactly as before —
  I don't have their source, so I left them untouched rather than
  guess at their internals. If you share those three files I can
  bring them in line with this styling too.

  All previous custom class names (admin-tab, field-grid, form-help,
  success-note, error-note, subject-checkbox-grid, etc.) have been
  replaced with explicit Tailwind utility classes, since those class
  names aren't defined anywhere in this file and may not exist in
  your stylesheet.
*/

/* ---------- Small inline icon set (explicit width/height, no reliance on Tailwind sizing) ---------- */

const TeacherIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="12" cy="7.5" r="3" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    <path d="M12 3.5 4 6.5l8 3 8-3-8-3Z" />
  </svg>
);

const LearnerIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.5 20c0-3.4 2.9-5.8 6.5-5.8s6.5 2.4 6.5 5.8" />
  </svg>
);

const ParentIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="9" cy="8" r="2.6" />
    <path d="M4 19c0-2.7 2.2-4.5 5-4.5s5 1.8 5 4.5" />
    <circle cx="17" cy="7.5" r="2" />
    <path d="M15.3 12.3c1.8.2 3.7 1.6 3.7 4.2" />
  </svg>
);

const ClassIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
  </svg>
);

const SubjectIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M3 5.5C3 4.67 3.67 4 4.5 4H10a2 2 0 0 1 2 2v13.5C11.4 19 9 18 4.5 18A1.5 1.5 0 0 1 3 16.5v-11Z" />
    <path d="M21 5.5c0-.83-.67-1.5-1.5-1.5H14a2 2 0 0 0-2 2v13.5c.6-.5 3-1.5 7.5-1.5A1.5 1.5 0 0 0 21 16.5v-11Z" />
  </svg>
);

const RefreshIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M4 4v5h5" />
    <path d="M20 20v-5h-5" />
    <path d="M4.6 9a8 8 0 0 1 14.1-3M19.4 15a8 8 0 0 1-14.1 3" />
  </svg>
);

/* ---------- Shared style tokens ---------- */

const INPUT_CLASSES =
  'w-full bg-slate-900/60 border border-teal-500/20 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/50 transition';

const LABEL_CLASSES = 'flex flex-col gap-1.5 text-sm font-medium text-slate-300';

const FIELD_GRID = 'grid grid-cols-1 sm:grid-cols-2 gap-4';

const SECTION_HEADING = 'text-xs font-semibold text-teal-300 uppercase tracking-wide mt-1';

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-300 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold px-5 py-2.5 rounded-lg transition text-sm mt-2';

/* Stat card for the always-visible KPI row */
function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-teal-500/10 bg-white/[0.02] backdrop-blur px-5 py-4 hover:border-teal-400/30 transition">
      <div
        style={{ width: 44, height: 44 }}
        className="flex-shrink-0 rounded-xl bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-300"
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-slate-400 mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

/* Chip-style checkbox used for subject selection */
function SubjectChip({ label, checked, onChange }) {
  return (
    <label className="relative cursor-pointer select-none">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-teal-500/20 bg-slate-900/40 text-xs font-medium text-slate-300 transition peer-checked:bg-teal-500/20 peer-checked:border-teal-400/60 peer-checked:text-teal-200 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-400/50">
        {label}
      </span>
    </label>
  );
}

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
    classId: '',
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
  });
  const [teacherForm, setTeacherForm] = useState({
    teacherFirstName: '',
    teacherLastName: '',
    teacherEmail: '',
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
      const deliveryNote = data.emailSent === false ? ' Credentials email could not be delivered automatically.' : '';

      setLearnerForm({
        learnerFirstName: '',
        learnerLastName: '',
        learnerEmail: '',
        classId: '',
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
      });

      setMessage(
        data.parentCreated
          ? `Learner and new parent were created and linked successfully.${deliveryNote}`
          : `Learner created and linked to the existing parent successfully.${deliveryNote}`
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
      const { data } = await api.post('/users/provision-teacher-assignment', teacherForm);
      const deliveryNote = data.emailSent === false ? ' Credentials email could not be delivered automatically.' : '';

      setTeacherForm({
        teacherFirstName: '',
        teacherLastName: '',
        teacherEmail: '',
        classId: '',
        subjectIds: [],
      });

      setMessage(`Teacher created and assigned to the selected class subjects successfully.${deliveryNote}`);
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

  const tabs = [
    { id: 'learners', label: 'Add Learners + Parents' },
    { id: 'teachers', label: 'Add Teachers + Subjects' },
    { id: 'records', label: 'View Records' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-950/70 backdrop-blur-md border-b border-teal-500/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/5 px-3 py-1 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span className="text-[11px] font-medium text-teal-300 tracking-wide uppercase">Admin Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Welcome, {user?.firstName}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Provision staff, learners, parents, classes, and subjects
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadAdminData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium rounded-lg transition disabled:opacity-50 text-sm"
            >
              <RefreshIcon size={14} />
              {loading ? 'Loading…' : 'Refresh Data'}
            </button>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg transition text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Stats row — always visible, not tucked behind a tab */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <StatCard icon={TeacherIcon} label="Teachers" value={counts.teachers} />
          <StatCard icon={LearnerIcon} label="Learners" value={counts.learners} />
          <StatCard icon={ParentIcon} label="Parents" value={counts.parents} />
          <StatCard icon={ClassIcon} label="Classes" value={counts.classes} />
          <StatCard icon={SubjectIcon} label="Subjects" value={counts.subjects} />
        </div>

        {/* Tabs */}
        <div className="inline-flex flex-wrap p-1 rounded-xl bg-slate-900/50 border border-teal-500/10 gap-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-teal-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-teal-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {message ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-sm px-4 py-3 mb-4">
            <span aria-hidden="true">✓</span>
            <span>{message}</span>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 text-red-300 text-sm px-4 py-3 mb-4">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        ) : null}

        <section>
          {activeTab === 'learners' ? (
            <AdminSectionCard title="Add Learner and Link Parent" className="section-card--wide">
              <form className="flex flex-col gap-5" onSubmit={handleProvisionLearnerFamily}>
                <h3 className={SECTION_HEADING}>Learner Details</h3>
                <div className={FIELD_GRID}>
                  <label className={LABEL_CLASSES}>
                    First name
                    <input
                      className={INPUT_CLASSES}
                      value={learnerForm.learnerFirstName}
                      onChange={(event) => handleLearnerFieldChange('learnerFirstName', event.target.value)}
                      required
                    />
                  </label>
                  <label className={LABEL_CLASSES}>
                    Last name
                    <input
                      className={INPUT_CLASSES}
                      value={learnerForm.learnerLastName}
                      onChange={(event) => handleLearnerFieldChange('learnerLastName', event.target.value)}
                      required
                    />
                  </label>
                </div>

                <div className={FIELD_GRID}>
                  <label className={LABEL_CLASSES}>
                    Learner email
                    <input
                      type="email"
                      className={INPUT_CLASSES}
                      value={learnerForm.learnerEmail}
                      onChange={(event) => handleLearnerFieldChange('learnerEmail', event.target.value)}
                      required
                    />
                  </label>
                </div>

                <p className="text-xs text-slate-400 bg-teal-500/5 border border-teal-500/10 rounded-lg px-3 py-2">
                  A default password is generated automatically and emailed after the account is created.
                </p>

                <label className={LABEL_CLASSES}>
                  Class
                  <select
                    className={INPUT_CLASSES}
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

                <h3 className={SECTION_HEADING}>Parent Details</h3>
                <p className="text-xs text-slate-400 bg-teal-500/5 border border-teal-500/10 rounded-lg px-3 py-2">
                  If the parent already exists, enter the same email and leave name/password blank.
                  This lets one parent be linked to multiple children.
                </p>

                <div className={FIELD_GRID}>
                  <label className={LABEL_CLASSES}>
                    Parent first name
                    <input
                      className={INPUT_CLASSES}
                      value={learnerForm.parentFirstName}
                      onChange={(event) => handleLearnerFieldChange('parentFirstName', event.target.value)}
                    />
                  </label>
                  <label className={LABEL_CLASSES}>
                    Parent last name
                    <input
                      className={INPUT_CLASSES}
                      value={learnerForm.parentLastName}
                      onChange={(event) => handleLearnerFieldChange('parentLastName', event.target.value)}
                    />
                  </label>
                </div>

                <div className={FIELD_GRID}>
                  <label className={LABEL_CLASSES}>
                    Parent email
                    <input
                      type="email"
                      className={INPUT_CLASSES}
                      value={learnerForm.parentEmail}
                      onChange={(event) => handleLearnerFieldChange('parentEmail', event.target.value)}
                      required
                    />
                  </label>
                </div>

                <button type="submit" disabled={saving.learnerFamily} className={PRIMARY_BUTTON}>
                  {saving.learnerFamily ? 'Saving…' : 'Add Learner and Link Parent'}
                </button>
              </form>
            </AdminSectionCard>
          ) : null}

          {activeTab === 'teachers' ? (
            <AdminSectionCard title="Add Teacher and Assign Subjects" className="section-card--wide">
              <form className="flex flex-col gap-5" onSubmit={handleProvisionTeacherAssignment}>
                <div className={FIELD_GRID}>
                  <label className={LABEL_CLASSES}>
                    First name
                    <input
                      className={INPUT_CLASSES}
                      value={teacherForm.teacherFirstName}
                      onChange={(event) => handleTeacherFieldChange('teacherFirstName', event.target.value)}
                      required
                    />
                  </label>
                  <label className={LABEL_CLASSES}>
                    Last name
                    <input
                      className={INPUT_CLASSES}
                      value={teacherForm.teacherLastName}
                      onChange={(event) => handleTeacherFieldChange('teacherLastName', event.target.value)}
                      required
                    />
                  </label>
                </div>

                <div className={FIELD_GRID}>
                  <label className={LABEL_CLASSES}>
                    Teacher email
                    <input
                      type="email"
                      className={INPUT_CLASSES}
                      value={teacherForm.teacherEmail}
                      onChange={(event) => handleTeacherFieldChange('teacherEmail', event.target.value)}
                      required
                    />
                  </label>
                </div>

                <p className="text-xs text-slate-400 bg-teal-500/5 border border-teal-500/10 rounded-lg px-3 py-2">
                  A default password is generated automatically and emailed after the account is created.
                </p>

                <label className={LABEL_CLASSES}>
                  Class
                  <select
                    className={INPUT_CLASSES}
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
                  <h3 className={SECTION_HEADING}>Subjects to Teach</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {subjects.map((subject) => (
                      <SubjectChip
                        key={subject.id}
                        label={subject.name}
                        checked={teacherForm.subjectIds.includes(subject.id)}
                        onChange={() => handleSubjectToggle(subject.id)}
                      />
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={saving.teacherAssignment} className={PRIMARY_BUTTON}>
                  {saving.teacherAssignment ? 'Saving…' : 'Add Teacher and Assign Subjects'}
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
    </div>
  );
}