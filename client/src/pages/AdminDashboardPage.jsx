import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardShell, {
  AlertBanner,
  ComposeCard,
  EmptyState,
  PageHeader,
  Panel,
  RowCard,
  StatusPill,
} from '../components/ui/DashboardShell';
import {
  FieldIcon,
  FormActions,
  FormCancelButton,
  FormCard,
  FormField,
  FormGrid,
  FormHelpCard,
  FormPage,
  FormPreviewCard,
  FormStatCard,
  FormStep,
  FormSubmitButton,
} from '../components/ui/FormKit';
import {
  IconClasses,
  IconLearners,
  IconRecords,
  IconSubjects,
  IconTeachers,
} from '../components/ui/DashIcons';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { resolveActiveTab, tabsForRole } from '../utils/dashNav';
import { parseApiError } from '../utils/errors';
import AdminOverview from '../components/admin/AdminOverview';
import AdminSummaryChips from '../components/admin/AdminSummaryChips';
import AdminRecordsPanel from '../components/admin/AdminRecordsPanel';

const RefreshIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M4 4v5h5" />
    <path d="M20 20v-5h-5" />
    <path d="M4.6 9a8 8 0 0 1 14.1-3M19.4 15a8 8 0 0 1-14.1 3" />
  </svg>
);

const PRIMARY_BUTTON = 'ic-btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed';

function SubjectChip({ label, checked, onChange }) {
  return (
    <label className="relative cursor-pointer select-none">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
        checked
          ? 'border-teal-500 bg-teal-500 text-white'
          : 'border-teal-200 bg-white text-slate-600'
      }`}>
        {label}
      </span>
    </label>
  );
}

function createTeacherAssignmentBlock(values = {}) {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    classId: values.classId ?? '',
    subjectIds: values.subjectIds ?? [],
  };
}

function AssignmentBlocksEditor({
  title,
  assignments,
  classes,
  subjects,
  onAddAssignment,
  onRemoveAssignment,
  onAssignmentClassChange,
  onToggleSubject,
}) {
  const selectedClassIds = new Set(assignments.map((assignment) => assignment.classId).filter(Boolean));

  return (
    <div className="space-y-4 sm:col-span-2">
      <div>
        <p className="ic-compose-title">{title}</p>
        <p className="ic-help !mt-0">
          Add one block per class. Pick the class, then select the subjects taught there.
        </p>
      </div>
      <div className="space-y-3">
        {assignments.map((assignment, index) => (
          <div key={assignment.id} className="ic-compose !mb-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Class assignment {index + 1}</p>
              {assignments.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onRemoveAssignment(assignment.id)}
                  className="ic-btn-danger"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <select
              value={assignment.classId}
              onChange={(event) => onAssignmentClassChange(assignment.id, event.target.value)}
              required
            >
              <option value="">Select class</option>
              {classes.map((classItem) => (
                <option
                  key={classItem.id}
                  value={classItem.id}
                  disabled={selectedClassIds.has(classItem.id) && assignment.classId !== classItem.id}
                >
                  {classItem.name}
                </option>
              ))}
            </select>

            <div>
              <p className="ic-compose-title !mb-2">Subjects</p>
              <div className="flex flex-wrap gap-2">
                {subjects.map((subject) => (
                  <SubjectChip
                    key={subject.id}
                    label={subject.name}
                    checked={assignment.subjectIds.includes(subject.id)}
                    onChange={() => onToggleSubject(assignment.id, subject.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={onAddAssignment} className="ic-btn-soft">
        Add another class
      </button>
    </div>
  );
}

function UserDetailModal({
  selectedUser,
  selectedUserDetails,
  detailForm,
  classes,
  subjects,
  savingDetails,
  deletingUser,
  onClose,
  onFieldChange,
  onClassChange,
  onAssignmentClassChange,
  onAddAssignment,
  onRemoveAssignment,
  onToggleAssignmentSubject,
  onSave,
  onDelete,
}) {
  if (!selectedUser || !detailForm) {
    return null;
  }

  const assignmentSummary = selectedUser.role === 'teacher' ? selectedUserDetails?.assignments ?? [] : [];

  return (
    <div className="ic-modal-backdrop">
      <div className="ic-modal overflow-hidden p-0 max-w-4xl">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-teal-100">
          <div>
            <p className="ic-kicker">School register</p>
            <h3 className="font-scribble text-2xl text-teal-900 mt-1 tracking-wide">
              {selectedUser.firstName} {selectedUser.lastName}
            </h3>
            <p className="text-sm text-slate-500 mt-1 capitalize">{selectedUser.role}</p>
          </div>

          <button type="button" onClick={onClose} className="ic-btn-ghost text-sm">
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5 p-6">
          <div className="space-y-4">
            <ComposeCard title="Edit details">
              <div className="ic-form-grid">
                <input
                  value={detailForm.firstName}
                  onChange={(event) => onFieldChange('firstName', event.target.value)}
                  placeholder="First name"
                  required
                />
                <input
                  value={detailForm.lastName}
                  onChange={(event) => onFieldChange('lastName', event.target.value)}
                  placeholder="Last name"
                  required
                />
                <input
                  type="email"
                  value={detailForm.email}
                  onChange={(event) => onFieldChange('email', event.target.value)}
                  placeholder="Email"
                  className="sm:col-span-2"
                  required
                />

                {selectedUser.role === 'learner' ? (
                  <select
                    value={detailForm.classId}
                    onChange={(event) => onClassChange(event.target.value)}
                    className="sm:col-span-2"
                    required
                  >
                    <option value="">Select class</option>
                    {classes.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {classItem.name}
                      </option>
                    ))}
                  </select>
                ) : null}

                {selectedUser.role === 'teacher' ? (
                  <AssignmentBlocksEditor
                    title="Teaching assignments"
                    assignments={detailForm.assignments}
                    classes={classes}
                    subjects={subjects}
                    onAddAssignment={onAddAssignment}
                    onRemoveAssignment={onRemoveAssignment}
                    onAssignmentClassChange={onAssignmentClassChange}
                    onToggleSubject={onToggleAssignmentSubject}
                  />
                ) : null}

                <div className="sm:col-span-2 flex flex-wrap gap-3 pt-1">
                  <button type="button" onClick={onSave} disabled={savingDetails} className={PRIMARY_BUTTON}>
                    {savingDetails ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={deletingUser}
                    className="ic-btn-danger disabled:opacity-50"
                  >
                    {deletingUser ? 'Deleting…' : 'Delete user'}
                  </button>
                </div>
              </div>
            </ComposeCard>
          </div>

          <div className="space-y-4">
            <div className="ic-compose !mb-0">
              <p className="ic-compose-title">Summary</p>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Role</dt>
                  <dd className="text-slate-800 capitalize font-semibold">{selectedUser.role}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="text-slate-800 break-all">{selectedUser.email}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Created</dt>
                  <dd className="text-slate-800">{new Date(selectedUser.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Updated</dt>
                  <dd className="text-slate-800">{new Date(selectedUser.updatedAt).toLocaleString()}</dd>
                </div>
              </dl>
            </div>

            {selectedUser.role === 'teacher' ? (
              <div className="ic-compose !mb-0">
                <p className="ic-compose-title">Current assignments</p>
                <div className="space-y-2">
                  {assignmentSummary.length === 0 ? (
                    <p className="text-sm text-slate-500">No class assignments yet.</p>
                  ) : (
                    assignmentSummary.map((assignment) => (
                      <div key={assignment.classId} className="ic-note-chip">
                        <p className="text-sm font-medium text-slate-800">{assignment.className}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {assignment.subjects.map((subject) => subject.name).join(', ')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {selectedUser.role === 'learner' ? (
              <div className="ic-compose !mb-0">
                <p className="ic-compose-title">Current class</p>
                <p className="text-sm text-slate-600">
                  {selectedUserDetails?.class ? selectedUserDetails.class.name : 'No class assigned.'}
                </p>
              </div>
            ) : null}

            {selectedUser.role === 'parent' ? (
              <div className="ic-compose !mb-0">
                <p className="ic-compose-title">Linked learners</p>
                <div className="space-y-2">
                  {selectedUserDetails?.learners?.length ? (
                    selectedUserDetails.learners.map((learner) => (
                      <p key={learner.id} className="ic-note-chip text-sm text-slate-700">
                        {learner.firstName} {learner.lastName}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No linked learners.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildDetailForm(selectedUser, selectedUserDetails) {
  if (!selectedUser) {
    return null;
  }

  const baseForm = {
    firstName: selectedUser.firstName ?? '',
    lastName: selectedUser.lastName ?? '',
    email: selectedUser.email ?? '',
    classId: '',
    assignments: [createTeacherAssignmentBlock()],
  };

  if (selectedUser.role === 'learner') {
    baseForm.classId = selectedUserDetails?.class?.id ?? '';
  }

  if (selectedUser.role === 'teacher') {
    const assignments = selectedUserDetails?.assignments ?? [];

    baseForm.assignments = assignments.length
      ? assignments.map((assignment) =>
          createTeacherAssignmentBlock({
            classId: assignment.classId,
            subjectIds: assignment.subjects.map((subject) => subject.id),
          })
        )
      : [createTeacherAssignmentBlock()];
  }

  return baseForm;
}

export default function AdminDashboardPage() {
  const { user, signOut } = useAuthSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const adminTabs = tabsForRole('admin');
  const initialTab = resolveActiveTab(searchParams.get('tab'), adminTabs);
  const [activeTab, setActiveTab] = useState(initialTab);

  function selectTab(id) {
    setActiveTab(id);
    setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true });
  }
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState({ learnerFamily: false, teacherAssignment: false });
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [selectedUserLoading, setSelectedUserLoading] = useState(false);
  const [selectedUserError, setSelectedUserError] = useState('');
  const [detailForm, setDetailForm] = useState(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
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
    assignments: [createTeacherAssignmentBlock()],
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
        assignments: [createTeacherAssignmentBlock()],
      });

      setMessage(`Teacher created and assigned to the selected class subjects successfully.${deliveryNote}`);
      await loadAdminData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to create and assign teacher.'));
    } finally {
      setSaving((current) => ({ ...current, teacherAssignment: false }));
    }
  }

  function handleTeacherAssignmentChange(assignmentId, value) {
    setTeacherForm((current) => ({
      ...current,
      assignments: current.assignments.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, classId: value } : assignment
      ),
    }));
  }

  function handleTeacherAssignmentToggleSubject(assignmentId, subjectId) {
    setTeacherForm((current) => ({
      ...current,
      assignments: current.assignments.map((assignment) => {
        if (assignment.id !== assignmentId) {
          return assignment;
        }

        const subjectIds = assignment.subjectIds.includes(subjectId)
          ? assignment.subjectIds.filter((item) => item !== subjectId)
          : [...assignment.subjectIds, subjectId];

        return {
          ...assignment,
          subjectIds,
        };
      }),
    }));
  }

  function addTeacherAssignmentBlock() {
    setTeacherForm((current) => ({
      ...current,
      assignments: [...current.assignments, createTeacherAssignmentBlock()],
    }));
  }

  function removeTeacherAssignmentBlock(assignmentId) {
    setTeacherForm((current) => ({
      ...current,
      assignments: current.assignments.length > 1
        ? current.assignments.filter((assignment) => assignment.id !== assignmentId)
        : current.assignments,
    }));
  }

  async function openUserDetails(record) {
    setSelectedUserLoading(true);
    setSelectedUserError('');
    setSelectedUser(record);
    setSelectedUserDetails(null);
    setDetailForm(null);

    try {
      const { data } = await api.get(`/users/${record.id}`);
      setSelectedUserDetails(data.details ?? null);
      setDetailForm(buildDetailForm(data.user, data.details ?? null));
    } catch (requestError) {
      setSelectedUserError(parseApiError(requestError, 'Failed to load user details.'));
    } finally {
      setSelectedUserLoading(false);
    }
  }

  function closeUserDetails() {
    setSelectedUser(null);
    setSelectedUserDetails(null);
    setSelectedUserError('');
    setDetailForm(null);
    setSavingDetails(false);
    setDeletingUser(false);
  }

  function handleDetailFieldChange(field, value) {
    setDetailForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function handleDetailClassChange(value) {
    setDetailForm((current) => (current ? { ...current, classId: value } : current));
  }

  function addDetailAssignmentBlock() {
    setDetailForm((current) =>
      current
        ? {
            ...current,
            assignments: [...current.assignments, createTeacherAssignmentBlock()],
          }
        : current
    );
  }

  function removeDetailAssignmentBlock(assignmentId) {
    setDetailForm((current) =>
      current
        ? {
            ...current,
            assignments:
              current.assignments.length > 1
                ? current.assignments.filter((assignment) => assignment.id !== assignmentId)
                : current.assignments,
          }
        : current
    );
  }

  function handleDetailAssignmentChange(assignmentId, value) {
    setDetailForm((current) =>
      current
        ? {
            ...current,
            assignments: current.assignments.map((assignment) =>
              assignment.id === assignmentId ? { ...assignment, classId: value } : assignment
            ),
          }
        : current
    );
  }

  function handleDetailAssignmentToggleSubject(assignmentId, subjectId) {
    setDetailForm((current) =>
      current
        ? {
            ...current,
            assignments: current.assignments.map((assignment) => {
              if (assignment.id !== assignmentId) {
                return assignment;
              }

              const subjectIds = assignment.subjectIds.includes(subjectId)
                ? assignment.subjectIds.filter((item) => item !== subjectId)
                : [...assignment.subjectIds, subjectId];

              return {
                ...assignment,
                subjectIds,
              };
            }),
          }
        : current
    );
  }

  async function handleSaveUserDetails() {
    if (!selectedUser || !detailForm) {
      return;
    }

    setSavingDetails(true);
    setSelectedUserError('');

    try {
      const payload = {
        firstName: detailForm.firstName,
        lastName: detailForm.lastName,
        email: detailForm.email,
      };

      if (selectedUser.role === 'learner') {
        payload.classId = detailForm.classId;
      }

      if (selectedUser.role === 'teacher') {
        payload.assignments = detailForm.assignments.map((assignment) => ({
          classId: assignment.classId,
          subjectIds: assignment.subjectIds,
        }));
      }

      const { data } = await api.put(`/users/${selectedUser.id}`, payload);

      setSelectedUser(data.user);
      setSelectedUserDetails(data.details ?? null);
      setDetailForm(buildDetailForm(data.user, data.details ?? null));
      setMessage(`Updated ${data.user.role} details successfully.`);
      await loadAdminData();
    } catch (requestError) {
      setSelectedUserError(parseApiError(requestError, 'Failed to update user.'));
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleDeleteUser() {
    if (!selectedUser) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedUser.firstName} ${selectedUser.lastName}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingUser(true);
    setSelectedUserError('');

    try {
      await api.delete(`/users/${selectedUser.id}`);
      setMessage(`Deleted ${selectedUser.role} successfully.`);
      closeUserDetails();
      await loadAdminData();
    } catch (requestError) {
      setSelectedUserError(parseApiError(requestError, 'Failed to delete user.'));
    } finally {
      setDeletingUser(false);
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

  const tabTitles = {
    overview: '',
    learners: 'Learners',
    teachers: 'Teachers',
    parents: 'Parents',
    classes: 'Classes',
    subjects: 'Subjects',
    records: 'User Accounts',
  };
  const tabSubtitles = {
    overview: '',
    learners: 'Create a learner account and link a parent in one step.',
    teachers: 'Create a teacher and assign their classes and subjects.',
    parents: 'Guardian accounts linked to learners at your school.',
    classes: 'Active class groups on the school register.',
    subjects: 'Curriculum subjects currently offered.',
    records: 'Open any staff, learner, or parent card to edit or remove it.',
  };

  return (
    <DashboardShell
      onSignOut={signOut}
      tabs={adminTabs}
      activeTab={activeTab}
      onTabChange={selectTab}
      sideTagline="Learn · Grow · Succeed"
      toolbarLead={(
        <span className="ic-school-pill">
          <IconClasses size={14} />
          IntelliClass School
        </span>
      )}
    >
      {activeTab !== 'overview' ? (
        <PageHeader
          kicker="School office"
          title={tabTitles[activeTab]}
          subtitle={tabSubtitles[activeTab]}
          doodle={false}
          actions={(
            <button
              type="button"
              onClick={loadAdminData}
              disabled={loading}
              className="ic-btn-soft text-sm disabled:opacity-50 inline-flex items-center gap-2"
            >
              <RefreshIcon size={14} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          )}
        />
      ) : null}

      <AlertBanner tone="ok">{message}</AlertBanner>
      <AlertBanner>{error}</AlertBanner>

      {activeTab === 'overview' ? (
        loading ? (
          <EmptyState>Opening the school office…</EmptyState>
        ) : (
          <AdminOverview
            firstName={user?.firstName}
            counts={counts}
            users={users}
            onSelectTab={selectTab}
          />
        )
      ) : null}

          {activeTab === 'learners' ? (
            <FormPage
              kicker="Learners"
              title="Add Learner"
              subtitle="Create a learner account and link a parent in one step."
              doodleCaption="Every learner deserves a strong start"
              aside={(
                <>
                  <FormHelpCard
                    items={[
                      'Fields marked with * are required.',
                      'A secure password is generated and emailed automatically.',
                      'Use an existing parent email to link another child.',
                      'Choose the class the learner will join.',
                    ]}
                  />
                  <FormStatCard
                    label="Total Learners"
                    value={counts.learners}
                    hint={`${counts.parents} parents on the register`}
                  />
                </>
              )}
            >
              <FormCard onSubmit={handleProvisionLearnerFamily}>
                <FormStep step={1} title="Learner information">
                  <FormGrid>
                    <FormField label="First name" required icon={FieldIcon.person}>
                      <input
                        value={learnerForm.learnerFirstName}
                        onChange={(event) => handleLearnerFieldChange('learnerFirstName', event.target.value)}
                        placeholder="e.g. Alicia"
                        required
                      />
                    </FormField>
                    <FormField label="Last name" required icon={FieldIcon.person}>
                      <input
                        value={learnerForm.learnerLastName}
                        onChange={(event) => handleLearnerFieldChange('learnerLastName', event.target.value)}
                        placeholder="e.g. Tau"
                        required
                      />
                    </FormField>
                    <FormField label="Learner email" required icon={FieldIcon.mail} className="fk-span-2">
                      <input
                        type="email"
                        value={learnerForm.learnerEmail}
                        onChange={(event) => handleLearnerFieldChange('learnerEmail', event.target.value)}
                        placeholder="learner@school.com"
                        required
                      />
                    </FormField>
                    <FormField
                      label="Password"
                      icon={FieldIcon.lock}
                      className="fk-span-2"
                      hint="Auto-generated and emailed when the account is created."
                    >
                      <input value="Auto-generated & emailed" readOnly />
                    </FormField>
                    <FormPreviewCard className="fk-span-2" title="Learner account">
                      Login details will be emailed to the learner after you save.
                    </FormPreviewCard>
                  </FormGrid>
                </FormStep>

                <FormStep step={2} title="Assign class">
                  <FormField label="Select class" required icon={FieldIcon.school}>
                    <select
                      value={learnerForm.classId}
                      onChange={(event) => handleLearnerFieldChange('classId', event.target.value)}
                      required
                    >
                      <option value="">Choose a class</option>
                      {classes.map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>
                          {classItem.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </FormStep>

                <FormStep step={3} title="Link parent">
                  <FormGrid>
                    <FormField label="Parent first name" icon={FieldIcon.person}>
                      <input
                        value={learnerForm.parentFirstName}
                        onChange={(event) => handleLearnerFieldChange('parentFirstName', event.target.value)}
                        placeholder="Optional if parent exists"
                      />
                    </FormField>
                    <FormField label="Parent last name" icon={FieldIcon.person}>
                      <input
                        value={learnerForm.parentLastName}
                        onChange={(event) => handleLearnerFieldChange('parentLastName', event.target.value)}
                        placeholder="Optional if parent exists"
                      />
                    </FormField>
                    <FormField label="Parent email" required icon={FieldIcon.mail} className="fk-span-2">
                      <input
                        type="email"
                        value={learnerForm.parentEmail}
                        onChange={(event) => handleLearnerFieldChange('parentEmail', event.target.value)}
                        placeholder="parent@email.com"
                        required
                      />
                    </FormField>
                  </FormGrid>
                </FormStep>

                <FormActions>
                  <FormCancelButton
                    onClick={() => setLearnerForm({
                      learnerFirstName: '',
                      learnerLastName: '',
                      learnerEmail: '',
                      classId: '',
                      parentFirstName: '',
                      parentLastName: '',
                      parentEmail: '',
                    })}
                  />
                  <FormSubmitButton disabled={saving.learnerFamily} busyLabel="Saving…">
                    Create learner
                  </FormSubmitButton>
                </FormActions>
              </FormCard>
            </FormPage>
          ) : null}

          {activeTab === 'teachers' ? (
            <FormPage
              kicker="Teachers"
              title="Add Teacher"
              subtitle="Create a teacher account and assign their classes and subjects."
              doodleCaption="Great teachers build great futures"
              aside={(
                <>
                  <FormHelpCard
                    items={[
                      'All fields marked with * are required.',
                      'A secure password is generated and emailed automatically.',
                      'Add one class block per teaching group.',
                      'Select the subjects taught in each class.',
                    ]}
                  />
                  <FormStatCard
                    label="Total Teachers"
                    value={counts.teachers}
                    hint="Staff currently on the register"
                  />
                </>
              )}
            >
              <FormCard onSubmit={handleProvisionTeacherAssignment}>
                <FormStep step={1} title="Personal information">
                  <FormGrid>
                    <FormField label="First name" required icon={FieldIcon.person}>
                      <input
                        value={teacherForm.teacherFirstName}
                        onChange={(event) => handleTeacherFieldChange('teacherFirstName', event.target.value)}
                        placeholder="e.g. Thabo"
                        required
                      />
                    </FormField>
                    <FormField label="Last name" required icon={FieldIcon.person}>
                      <input
                        value={teacherForm.teacherLastName}
                        onChange={(event) => handleTeacherFieldChange('teacherLastName', event.target.value)}
                        placeholder="e.g. Molefe"
                        required
                      />
                    </FormField>
                    <FormField label="Email address" required icon={FieldIcon.mail} className="fk-span-2">
                      <input
                        type="email"
                        value={teacherForm.teacherEmail}
                        onChange={(event) => handleTeacherFieldChange('teacherEmail', event.target.value)}
                        placeholder="teacher@school.com"
                        required
                      />
                    </FormField>
                    <FormField
                      label="Password"
                      icon={FieldIcon.lock}
                      className="fk-span-2"
                      hint="Auto-generated and emailed when the account is created."
                    >
                      <input value="Auto-generated & emailed" readOnly />
                    </FormField>
                    <FormPreviewCard className="fk-span-2" title="Teacher account">
                      Login details will be emailed to the teacher after you save.
                    </FormPreviewCard>
                  </FormGrid>
                </FormStep>

                <FormStep step={2} title="Assign classes & subjects">
                  <AssignmentBlocksEditor
                    title="Teaching assignments"
                    assignments={teacherForm.assignments}
                    classes={classes}
                    subjects={subjects}
                    onAddAssignment={addTeacherAssignmentBlock}
                    onRemoveAssignment={removeTeacherAssignmentBlock}
                    onAssignmentClassChange={handleTeacherAssignmentChange}
                    onToggleSubject={handleTeacherAssignmentToggleSubject}
                  />
                </FormStep>

                <FormActions>
                  <FormCancelButton
                    onClick={() => setTeacherForm({
                      teacherFirstName: '',
                      teacherLastName: '',
                      teacherEmail: '',
                      assignments: [createTeacherAssignmentBlock()],
                    })}
                  />
                  <FormSubmitButton disabled={saving.teacherAssignment} busyLabel="Saving…">
                    Create teacher
                  </FormSubmitButton>
                </FormActions>
              </FormCard>
            </FormPage>
          ) : null}

          {activeTab === 'parents' ? (
            <Panel
              title="Parents"
              subtitle="Guardian accounts on the school register."
              icon={IconLearners}
              tone="purple"
            >
              {parents.length === 0 ? (
                <EmptyState>No parents yet. They are created when you add a learner.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {parents.map((parent) => (
                    <RowCard
                      key={parent.id}
                      as="button"
                      type="button"
                      icon={IconLearners}
                      tone="purple"
                      onClick={() => openUserDetails(parent)}
                    >
                      <div className="ic-list-body">
                        <h3 className="ic-list-title">{parent.firstName} {parent.lastName}</h3>
                        <p className="ic-list-meta">{parent.email}</p>
                      </div>
                      <div className="ic-list-actions">
                        <span className="ic-btn-soft">Open</span>
                      </div>
                    </RowCard>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {activeTab === 'classes' ? (
            <Panel
              title="Classes"
              subtitle="Class groups used when enrolling learners and assigning teachers."
              icon={IconClasses}
              tone="purple"
            >
              {classes.length === 0 ? (
                <EmptyState>No classes found.</EmptyState>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {classes.map((classItem) => (
                    <RowCard key={classItem.id} icon={IconClasses} tone="purple">
                      <div className="ic-list-body">
                        <h3 className="ic-list-title">{classItem.name}</h3>
                        <p className="ic-list-meta">
                          {[classItem.gradeLevel || classItem.grade_level, classItem.academicYear || classItem.academic_year]
                            .filter(Boolean)
                            .join(' · ') || 'Active class group'}
                        </p>
                      </div>
                      <div className="ic-list-actions">
                        <StatusPill tone="ok">Active</StatusPill>
                      </div>
                    </RowCard>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {activeTab === 'subjects' ? (
            <Panel
              title="Subjects"
              subtitle="Curriculum subjects available for teacher assignments."
              icon={IconSubjects}
              tone="orange"
            >
              {subjects.length === 0 ? (
                <EmptyState>No subjects found.</EmptyState>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {subjects.map((subject) => (
                    <RowCard key={subject.id} icon={IconSubjects} tone="orange">
                      <div className="ic-list-body">
                        <h3 className="ic-list-title">{subject.name}</h3>
                        <p className="ic-list-meta">{subject.code || 'Curriculum subject'}</p>
                      </div>
                      <div className="ic-list-actions">
                        <StatusPill tone="orange">Offered</StatusPill>
                      </div>
                    </RowCard>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {activeTab === 'records' ? (
            <Panel
              title="User Accounts"
              subtitle="Open any staff, learner, or parent card to edit or remove it."
              icon={IconRecords}
              tone="purple"
            >
              <AdminSummaryChips counts={counts} />
              <AdminRecordsPanel teachers={teachers} learners={learners} parents={parents} onSelectUser={openUserDetails} />
            </Panel>
          ) : null}

      {selectedUser ? (
        selectedUserLoading ? (
          <div className="ic-modal-backdrop flex items-center justify-center">
            <div className="ic-modal max-w-md text-slate-700">
              Opening the register card…
            </div>
          </div>
        ) : selectedUserError ? (
          <div className="ic-modal-backdrop flex items-center justify-center">
            <div className="ic-modal max-w-lg">
              <div className="flex items-start justify-between gap-4">
                <p className="text-rose-800">{selectedUserError}</p>
                <button type="button" onClick={closeUserDetails} className="ic-btn-ghost text-sm">
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          <UserDetailModal
            selectedUser={selectedUser}
            selectedUserDetails={selectedUserDetails}
            detailForm={detailForm}
            classes={classes}
            subjects={subjects}
            savingDetails={savingDetails}
            deletingUser={deletingUser}
            onClose={closeUserDetails}
            onFieldChange={handleDetailFieldChange}
            onClassChange={handleDetailClassChange}
            onAddAssignment={addDetailAssignmentBlock}
            onRemoveAssignment={removeDetailAssignmentBlock}
            onToggleAssignmentSubject={handleDetailAssignmentToggleSubject}
            onSave={handleSaveUserDetails}
            onDelete={handleDeleteUser}
          />
        )
      ) : null}
    </DashboardShell>
  );
}