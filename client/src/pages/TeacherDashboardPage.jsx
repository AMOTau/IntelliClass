import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AiHistoryPanel from '../components/AiHistoryPanel';
import AiQuizOptions from '../components/AiQuizOptions';
import AiRegeneratePanel from '../components/AiRegeneratePanel';
import HomeworkMarkingPanel from '../components/HomeworkMarkingPanel';
import { LEARNER_TEMPLATE_OPTIONS } from '../components/LearnerQuizPlay';
import ParentMessageForm from '../components/ParentMessageForm';
import QuizScopePicker, { scopeIsValid } from '../components/QuizScopePicker';
import ReportPublishForm from '../components/ReportPublishForm';
import DashboardShell, {
  AlertBanner,
  EmptyState,
  PageHeader,
  Panel,
  QuickStart,
  RowCard,
  StatGrid,
  StatusPill,
} from '../components/ui/DashboardShell';
import {
  FieldIcon,
  FormActions,
  FormCard,
  FormField,
  FormGrid,
  FormHelpCard,
  FormStep,
  FormSubmitButton,
} from '../components/ui/FormKit';
import {
  IconClasses,
  IconHomework,
  IconLearners,
  IconMaterials,
  IconMessages,
  IconQuizzes,
  IconReports,
  IconSubjects,
} from '../components/ui/DashIcons';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { resolveActiveTab, tabsForRole } from '../utils/dashNav';
import { FEATURES } from '../utils/featureFlags';
import { formatDueDate } from '../utils/dates';
import { parseApiError } from '../utils/errors';
import { AI_MAX_QUESTIONS, AI_MIN_QUESTIONS, DIFFICULTY_OPTIONS } from '../utils/quizDifficulty';

const fileOrigin = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/api\/?$/, '');

function questionPayload(questions) {
  return questions.map((question, index) => ({
    questionText: question.questionText,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    difficulty: question.difficulty,
    topic: question.topic,
    questionOrder: index + 1,
  }));
}

function generationNotice(data, fallback) {
  if (data.source === 'local-fallback') {
    return 'The AI was unavailable, so a draft was built directly from your notes. Review it before publishing.';
  }
  return fallback;
}

function blankQuestion(order = 1) {
  return {
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    explanation: '',
    difficulty: 'medium',
    topic: '',
    questionOrder: order,
  };
}

export default function TeacherDashboardPage() {
  const { user, signOut } = useAuthSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const teacherTabs = tabsForRole('teacher');
  const initialTab = resolveActiveTab(searchParams.get('tab'), teacherTabs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [notice, setNotice] = useState('');
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [quizDraft, setQuizDraft] = useState(null);
  const [quizWarning, setQuizWarning] = useState('');
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [dashData, setDashData] = useState({
    classes: [],
    subjects: [],
    totalLearners: 0,
    summary: { totalClasses: 0, totalSubjects: 0, totalLearners: 0 },
    recentQuizzes: [],
    recentHomework: [],
  });
  const [uploadForm, setUploadForm] = useState({
    title: '',
    subjectId: '',
    classId: '',
    file: null,
  });
  const [homeworkForm, setHomeworkForm] = useState({
    title: '',
    description: '',
    classId: '',
    subjectId: '',
    dueDate: '',
    maxScore: 10,
  });
  const [savingHomework, setSavingHomework] = useState(false);
  const [markingHomework, setMarkingHomework] = useState(null);
  const [reports, setReports] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab);

  function selectTab(id) {
    setActiveTab(id);
    setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true });
  }

  useEffect(() => {
    loadTeacherData();
  }, []);

  async function loadTeacherData() {
    setLoading(true);
    setError('');

    try {
      const [dashboardResponse, materialsResponse, quizzesResponse, reportsResponse, messagesResponse] = await Promise.all([
        api.get('/dashboard/teacher'),
        api.get('/materials'),
        api.get('/quizzes'),
        api.get('/reports'),
        api.get('/messages'),
      ]);
      setDashData({
        ...dashboardResponse.data,
        recentQuizzes: quizzesResponse.data.quizzes ?? dashboardResponse.data.recentQuizzes ?? [],
        learners: dashboardResponse.data.learners ?? [],
      });
      setMaterials(materialsResponse.data.materials ?? []);
      setReports(reportsResponse.data.reports ?? []);
      setSentMessages(messagesResponse.data.messages ?? []);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }

  const defaultClassId = dashData.classes[0]?.id ?? '';
  const defaultSubjectId = dashData.subjects[0]?.id ?? '';

  const readyToUpload = useMemo(
    () => Boolean(uploadForm.file && (uploadForm.classId || defaultClassId) && (uploadForm.subjectId || defaultSubjectId)),
    [uploadForm, defaultClassId, defaultSubjectId]
  );

  async function handleMaterialUpload(event) {
    event.preventDefault();
    setUploading(true);
    setUploadError('');
    setNotice('');

    try {
      const formData = new FormData();
      const classId = uploadForm.classId || defaultClassId;
      const subjectId = uploadForm.subjectId || defaultSubjectId;
      formData.append('title', uploadForm.title);
      formData.append('classId', classId);
      formData.append('subjectId', subjectId);
      formData.append('file', uploadForm.file);

      const { data } = await api.post('/materials/upload', formData);
      setUploadForm({ title: '', subjectId, classId, file: null });
      event.target.reset?.();
      setNotice('PDF uploaded and text extracted. You can create a quiz from it now.');
      await loadTeacherData();
      if (data.material) {
        startQuizFromMaterial(data.material);
      }
    } catch (requestError) {
      setUploadError(parseApiError(requestError, 'Failed to upload material.'));
    } finally {
      setUploading(false);
    }
  }

  async function openMaterial(materialId) {
    setError('');
    try {
      const { data } = await api.get(`/materials/${materialId}`);
      setSelectedMaterial(data.material ?? null);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load material.'));
    }
  }

  async function deleteMaterial(materialId) {
    if (!window.confirm('Delete this material?')) {
      return;
    }

    try {
      await api.delete(`/materials/${materialId}`);
      if (selectedMaterial?.id === materialId) {
        setSelectedMaterial(null);
      }
      setNotice('Material deleted.');
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to delete material.'));
    }
  }

  function startQuizFromMaterial(material) {
    setQuizWarning('');
    setQuizDraft({
      material,
      title: `${material.title} Quiz`,
      classId: material.classId || defaultClassId,
      subjectId: material.subjectId || defaultSubjectId,
      dueDate: '',
      questionCount: 8,
      learnerTemplate: 'classic',
      mode: 'ai',
      quiz: null,
      scope: { materialIds: [material.id], chapterSelection: {} },
      ai: { questionCount: 8, difficultyMix: 'balanced', instructions: '' },
      historyKey: 0,
    });
  }

  async function generateQuiz() {
    if (!quizDraft?.material) {
      return;
    }

    if (!scopeIsValid(quizDraft.scope)) {
      setError('Choose at least one material and tick at least one chapter for each chosen material.');
      return;
    }

    setGeneratingQuiz(true);
    setQuizWarning('');
    setError('');
    const statusSteps = [
      'Reading the selected chapters…',
      'Writing questions with Gemini…',
      'Checking answers and difficulty…',
      'Almost done — packing your draft…',
    ];
    setGeneratingStatus(statusSteps[0]);
    let step = 0;
    const statusTimer = window.setInterval(() => {
      step = Math.min(step + 1, statusSteps.length - 1);
      setGeneratingStatus(statusSteps[step]);
    }, 4500);

    try {
      const questionCount = Math.min(Math.max(Number(quizDraft.ai.questionCount) || 8, AI_MIN_QUESTIONS), AI_MAX_QUESTIONS);
      const { data } = await api.post('/ai/generate-quiz', {
        materialIds: quizDraft.scope.materialIds,
        chapterSelection: quizDraft.scope.chapterSelection,
        title: quizDraft.title,
        classId: quizDraft.classId || quizDraft.material.classId,
        subjectId: quizDraft.subjectId || quizDraft.material.subjectId,
        questionCount,
        difficultyMix: quizDraft.ai.difficultyMix,
        instructions: quizDraft.ai.instructions,
        learnerTemplate: quizDraft.learnerTemplate || 'classic',
        dueDate: quizDraft.dueDate || null,
      });

      setQuizDraft((current) => ({
        ...current,
        quiz: data.quiz,
        dueDate: data.quiz.dueDate || current.dueDate || '',
        mode: 'ai',
        historyKey: current.historyKey + 1,
      }));
      setQuizWarning(data.warning || '');
      setNotice(generationNotice(data, 'Draft quiz ready. Edit anything that looks off, then publish.'));
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to generate quiz.'));
    } finally {
      window.clearInterval(statusTimer);
      setGeneratingStatus('');
      setGeneratingQuiz(false);
    }
  }

  async function startManualQuiz() {
    if (!quizDraft?.material) {
      return;
    }

    setGeneratingQuiz(true);
    setQuizWarning('');
    setError('');

    try {
      const count = Math.min(Math.max(Number(quizDraft.ai.questionCount) || 5, 1), AI_MAX_QUESTIONS);
      const { data } = await api.post('/quizzes/create', {
        title: quizDraft.title || `${quizDraft.material.title} Quiz`,
        classId: quizDraft.classId || quizDraft.material.classId,
        subjectId: quizDraft.subjectId || quizDraft.material.subjectId,
        materialId: quizDraft.material.id,
        learnerTemplate: quizDraft.learnerTemplate || 'classic',
        dueDate: quizDraft.dueDate || null,
        questions: Array.from({ length: count }, (_, index) => blankQuestion(index + 1)).map((question) => ({
          ...question,
          questionText: `Question ${question.questionOrder}`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 'Option A',
        })),
      });

      setQuizDraft((current) => ({
        ...current,
        quiz: data.quiz,
        dueDate: data.quiz.dueDate || current.dueDate || '',
        mode: 'manual',
      }));
      setNotice('Manual quiz draft ready. Write your own questions and answers, then publish.');
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to start manual quiz.'));
    } finally {
      setGeneratingQuiz(false);
    }
  }

  async function regenerateDraftQuestions({ questionCount, difficultyMix, instructions, mode }) {
    if (!quizDraft?.quiz?.id) {
      return;
    }

    setGeneratingQuiz(true);
    setQuizWarning('');
    setError('');

    try {
      // Save edits first so "Add more" keeps them and the AI avoids repeating them.
      await api.put(`/quizzes/${quizDraft.quiz.id}`, {
        title: quizDraft.title || quizDraft.quiz.title,
        learnerTemplate: quizDraft.learnerTemplate || 'classic',
        dueDate: quizDraft.dueDate || null,
        questions: questionPayload(quizDraft.quiz.questions ?? []),
      });

      const { data } = await api.post('/ai/regenerate-quiz', {
        quizId: quizDraft.quiz.id,
        questionCount,
        difficultyMix,
        instructions,
        mode,
      });
      setQuizDraft((current) => ({
        ...current,
        quiz: data.quiz,
        dueDate: data.quiz.dueDate || current.dueDate || '',
        mode: 'ai',
        historyKey: current.historyKey + 1,
      }));
      setQuizWarning(data.warning || '');
      setNotice(generationNotice(
        data,
        mode === 'append' ? `${data.addedCount} new question(s) added from the study material.` : 'Fresh questions generated from the study material.'
      ));
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to regenerate questions.'));
    } finally {
      setGeneratingQuiz(false);
    }
  }

  function updateDraftQuestion(index, field, value) {
    setQuizDraft((current) => {
      if (!current?.quiz) {
        return current;
      }

      const questions = current.quiz.questions.map((question, questionIndex) => {
        if (questionIndex !== index) {
          return question;
        }

        if (field.startsWith('option-')) {
          const optionIndex = Number(field.split('-')[1]);
          const options = [...question.options];
          const previous = options[optionIndex];
          options[optionIndex] = value;
          return {
            ...question,
            options,
            correctAnswer: question.correctAnswer === previous ? value : question.correctAnswer,
          };
        }

        return { ...question, [field]: value };
      });

      return { ...current, quiz: { ...current.quiz, questions } };
    });
  }

  async function saveAndPublish() {
    if (!quizDraft?.quiz) {
      return;
    }

    setPublishing(true);
    setError('');

    try {
      await api.put(`/quizzes/${quizDraft.quiz.id}`, {
        title: quizDraft.title || quizDraft.quiz.title,
        learnerTemplate: quizDraft.learnerTemplate || 'classic',
        dueDate: quizDraft.dueDate || null,
        questions: questionPayload(quizDraft.quiz.questions),
      });

      await api.post(`/quizzes/${quizDraft.quiz.id}/publish`);
      setNotice(
        quizDraft.dueDate
          ? `Quiz published. Learners should complete it by ${formatDueDate(quizDraft.dueDate)}.`
          : 'Quiz published to the class. Learners will see your chosen template.'
      );
      setQuizDraft(null);
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to publish quiz.'));
    } finally {
      setPublishing(false);
    }
  }

  async function handleCreateHomework(event) {
    event.preventDefault();
    setSavingHomework(true);
    setError('');
    setNotice('');

    try {
      await api.post('/homework', {
        title: homeworkForm.title,
        description: homeworkForm.description,
        classId: homeworkForm.classId || defaultClassId,
        subjectId: homeworkForm.subjectId || defaultSubjectId,
        dueDate: homeworkForm.dueDate,
        maxScore: homeworkForm.maxScore,
      });
      setHomeworkForm({
        title: '',
        description: '',
        classId: homeworkForm.classId || defaultClassId,
        subjectId: homeworkForm.subjectId || defaultSubjectId,
        dueDate: '',
        maxScore: homeworkForm.maxScore || 10,
      });
      setNotice('Homework assigned. Each parent has been written to, with an invitation to contact you if they need to talk.');
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to assign homework.'));
    } finally {
      setSavingHomework(false);
    }
  }

  async function deleteHomework(homeworkId) {
    if (!window.confirm('Delete this homework?')) {
      return;
    }

    try {
      await api.delete(`/homework/${homeworkId}`);
      setNotice('Homework deleted.');
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to delete homework.'));
    }
  }

  async function deleteQuiz(quizId) {
    if (!window.confirm('Delete this quiz? Learners will lose access to it.')) {
      return;
    }

    try {
      await api.delete(`/quizzes/${quizId}`);
      setNotice('Quiz deleted.');
      await loadTeacherData();
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to delete quiz.'));
    }
  }

  return (
    <DashboardShell
      onSignOut={signOut}
      tabs={teacherTabs}
      activeTab={activeTab}
      onTabChange={selectTab}
    >
      <PageHeader
        kicker={activeTab === 'overview' ? 'Staff dashboard' : 'Staff desk'}
        title={
          activeTab === 'overview' ? `Welcome, ${user?.firstName}!`
            : activeTab === 'materials' ? 'Study materials'
              : activeTab === 'homework' ? 'Homework'
                : activeTab === 'quizzes' ? 'Quizzes'
                  : activeTab === 'messages' ? 'Write to parents'
                    : 'Term reports'
        }
        subtitle={
          activeTab === 'overview'
            ? "Here's a quick overview of your academic management tools and activities."
            : activeTab === 'materials'
              ? 'Upload a PDF. IntelliClass extracts the text and can draft a quiz from it.'
              : activeTab === 'homework'
                ? 'Assign work, then mark it. Parents hear from you when it is set, handed in, and marked.'
                : activeTab === 'quizzes'
                  ? 'Open a draft, edit questions, or publish to the class.'
                  : activeTab === 'messages'
                    ? 'They receive this as an alert on IntelliClass.'
                    : 'Freeze a snapshot for a date range, add a comment, and send it to the parent.'
        }
        doodle={activeTab === 'overview'}
      />

      <AlertBanner tone="error">{error}</AlertBanner>
      <AlertBanner tone="ok">{notice}</AlertBanner>

      {loading ? (
        <EmptyState>Preparing your classroom…</EmptyState>
      ) : (
        <>
          {activeTab === 'overview' ? (
            <StatGrid
              items={[
                {
                  label: 'Classes',
                  value: dashData.summary?.totalClasses ?? dashData.classes.length,
                  hint: 'Manage your classes and subjects',
                  icon: IconClasses,
                  tone: 'teal',
                  onClick: () => selectTab('materials'),
                },
                {
                  label: 'Learners',
                  value: dashData.summary?.totalLearners ?? dashData.totalLearners,
                  hint: 'View learner progress and performance',
                  icon: IconLearners,
                  tone: 'blue',
                  onClick: () => selectTab(FEATURES.homework ? 'homework' : 'quizzes'),
                },
                {
                  label: 'Subjects',
                  value: dashData.summary?.totalSubjects ?? dashData.subjects.length,
                  hint: 'Manage subjects and curriculum',
                  icon: IconSubjects,
                  tone: 'purple',
                  onClick: () => selectTab('materials'),
                },
                {
                  label: 'Quizzes',
                  value: dashData.recentQuizzes?.length ?? 0,
                  hint: 'Create, manage and track quizzes',
                  icon: IconQuizzes,
                  tone: 'orange',
                  onClick: () => selectTab('quizzes'),
                },
              ]}
            />
          ) : null}

          {activeTab === 'materials' ? (
          <Panel
            title="Study materials"
            subtitle="Upload a PDF. IntelliClass extracts the text and can draft a quiz from it."
            icon={IconMaterials}
            tone="teal"
          >
            {uploadError ? <AlertBanner>{uploadError}</AlertBanner> : null}

            <div className="fk-layout fk-layout--split mb-5">
              <FormCard onSubmit={handleMaterialUpload}>
                <FormStep step={1} title="Material details">
                  <FormGrid>
                    <FormField label="Title" icon={FieldIcon.file} className="fk-span-2">
                      <input
                        type="text"
                        value={uploadForm.title}
                        onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Title (optional)"
                      />
                    </FormField>
                    <FormField label="Class" required icon={FieldIcon.school}>
                      <select
                        value={uploadForm.classId || defaultClassId}
                        onChange={(event) => setUploadForm((current) => ({ ...current, classId: event.target.value }))}
                        required
                      >
                        <option value="">Select class</option>
                        {dashData.classes.map((classItem) => (
                          <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Subject" required icon={FieldIcon.book}>
                      <select
                        value={uploadForm.subjectId || defaultSubjectId}
                        onChange={(event) => setUploadForm((current) => ({ ...current, subjectId: event.target.value }))}
                        required
                      >
                        <option value="">Select subject</option>
                        {dashData.subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))}
                      </select>
                    </FormField>
                  </FormGrid>
                </FormStep>
                <FormStep step={2} title="Upload PDF">
                  <FormField label="PDF file" required icon={FieldIcon.file}>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                      className="file:mr-3 file:rounded-md file:border-0 file:bg-teal-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                      required
                    />
                  </FormField>
                </FormStep>
                <FormActions>
                  <span />
                  <FormSubmitButton disabled={uploading || !readyToUpload} busyLabel="Uploading…">
                    Upload PDF
                  </FormSubmitButton>
                </FormActions>
              </FormCard>
              <aside className="fk-aside">
                <FormHelpCard
                  items={[
                    'Upload a clear PDF so text can be extracted.',
                    'You can draft a quiz from the material afterwards.',
                    'Learners will see shared materials on their desk.',
                  ]}
                />
              </aside>
            </div>

            <div className="space-y-3">
              {materials.length === 0 ? (
                <EmptyState>No study materials yet.</EmptyState>
              ) : (
                materials.map((material) => (
                  <RowCard key={material.id} icon={IconMaterials} tone="teal">
                    <div className="ic-list-body">
                      <h3 className="ic-list-title">{material.title}</h3>
                      <p className="ic-list-meta">
                        {material.subject || 'Subject not set'} · {material.className || 'Class not set'}
                        {material.hasExtractedText ? ' · Text extracted' : ' · No text extracted'}
                      </p>
                    </div>
                    <div className="ic-list-actions">
                      <button type="button" onClick={() => startQuizFromMaterial(material)} className="ic-btn-primary text-sm">
                        Create quiz
                      </button>
                      <button type="button" onClick={() => openMaterial(material.id)} className="ic-btn-soft">
                        Preview
                      </button>
                      <a href={`${fileOrigin}${material.fileUrl}`} target="_blank" rel="noreferrer" className="ic-btn-soft">
                        PDF
                      </a>
                      <button type="button" onClick={() => deleteMaterial(material.id)} className="ic-btn-danger">
                        Delete
                      </button>
                    </div>
                  </RowCard>
                ))
              )}
            </div>
          </Panel>
          ) : null}

          {FEATURES.homework && activeTab === 'homework' ? (
          <Panel
            title="Homework"
            subtitle="Assign work, then mark it. Parents hear from you when it is set, handed in, and marked."
            icon={IconHomework}
            tone="blue"
          >
            <div className="fk-layout fk-layout--split mb-5">
              <FormCard onSubmit={handleCreateHomework}>
                <FormStep step={1} title="Homework details">
                  <FormGrid>
                    <FormField label="Title" required icon={FieldIcon.file} className="fk-span-2">
                      <input
                        type="text"
                        value={homeworkForm.title}
                        onChange={(event) => setHomeworkForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Homework title"
                        required
                      />
                    </FormField>
                    <FormField label="Due date" required icon={FieldIcon.calendar}>
                      <input
                        type="date"
                        value={homeworkForm.dueDate}
                        onChange={(event) => setHomeworkForm((current) => ({ ...current, dueDate: event.target.value }))}
                        required
                      />
                    </FormField>
                    <FormField label="Marked out of" icon={FieldIcon.book}>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={homeworkForm.maxScore}
                        onChange={(event) => setHomeworkForm((current) => ({ ...current, maxScore: event.target.value }))}
                        placeholder="10"
                      />
                    </FormField>
                  </FormGrid>
                </FormStep>
                <FormStep step={2} title="Assign to a class">
                  <FormGrid>
                    <FormField label="Class" required icon={FieldIcon.school}>
                      <select
                        value={homeworkForm.classId || defaultClassId}
                        onChange={(event) => setHomeworkForm((current) => ({ ...current, classId: event.target.value }))}
                        required
                      >
                        <option value="">Select class</option>
                        {dashData.classes.map((classItem) => (
                          <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Subject" required icon={FieldIcon.book}>
                      <select
                        value={homeworkForm.subjectId || defaultSubjectId}
                        onChange={(event) => setHomeworkForm((current) => ({ ...current, subjectId: event.target.value }))}
                        required
                      >
                        <option value="">Select subject</option>
                        {dashData.subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Instructions" icon={FieldIcon.message} className="fk-span-2">
                      <textarea
                        value={homeworkForm.description}
                        onChange={(event) => setHomeworkForm((current) => ({ ...current, description: event.target.value }))}
                        placeholder="Instructions (optional)"
                      />
                    </FormField>
                  </FormGrid>
                </FormStep>
                <FormActions>
                  <span />
                  <FormSubmitButton disabled={savingHomework} busyLabel="Assigning…">
                    Assign homework
                  </FormSubmitButton>
                </FormActions>
              </FormCard>
              <aside className="fk-aside">
                <FormHelpCard
                  items={[
                    'Parents are notified when homework is set.',
                    'Mark the class once learners hand work in.',
                    'Keep instructions short and clear.',
                  ]}
                />
              </aside>
            </div>

            <div className="space-y-3">
              {(dashData.recentHomework ?? []).length === 0 ? (
                <EmptyState>No homework assigned yet.</EmptyState>
              ) : (
                dashData.recentHomework.map((item) => (
                  <RowCard key={item.id} icon={IconHomework} tone="blue">
                    <div className="ic-list-body">
                      <h3 className="ic-list-title">{item.title}</h3>
                      <p className="ic-list-meta">
                        {item.subject || 'Subject'} · {item.class_name || 'Class'} · Due {formatDueDate(item.due_date)}
                        {item.submitted_count != null ? ` · ${item.submitted_count}/${item.learner_count || 0} handed in` : ''}
                        {item.graded_count != null ? ` · ${item.graded_count} marked` : ''}
                      </p>
                    </div>
                    <div className="ic-list-actions">
                      <button type="button" onClick={() => setMarkingHomework(item)} className="ic-btn-primary text-sm">
                        Mark class
                      </button>
                      <button type="button" onClick={() => deleteHomework(item.id)} className="ic-btn-danger">
                        Delete
                      </button>
                    </div>
                  </RowCard>
                ))
              )}
            </div>
          </Panel>
          ) : null}

          {activeTab === 'messages' ? (
          <Panel
            title="Write to parents"
            subtitle="Parents see this as an alert on IntelliClass (Teacher notes). Add your phone number on your profile so they know how to reach you."
            icon={IconMessages}
            tone="orange"
          >
            <ParentMessageForm
              classes={dashData.classes}
              learners={dashData.learners ?? []}
              onSent={loadTeacherData}
            />
            {sentMessages.length ? (
              <div className="space-y-3">
                <p className="ic-compose-title">Recently sent</p>
                {sentMessages.slice(0, 8).map((note) => (
                  <div key={note.id} className="ic-note-chip space-y-2">
                    <p>
                      <span className="font-semibold">{note.title}</span>
                      {' · '}
                      {note.parentName ? `${note.parentName} · ` : ''}
                      {note.childName || note.className || 'Parents'}
                      {' · '}
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                    {note.parentReply ? (
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold text-teal-800">Parent reply:</span>{' '}
                        {note.parentReply}
                        {note.parentRepliedAt
                          ? ` · ${new Date(note.parentRepliedAt).toLocaleString()}`
                          : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">No reply yet.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>
          ) : null}

          {FEATURES.termReports && activeTab === 'reports' ? (
          <Panel
            title="Term reports"
            subtitle="Freeze a snapshot for a date range, add a comment, and send it to the parent. Later marks will not rewrite what they already saw."
            icon={IconReports}
            tone="mint"
          >
            <ReportPublishForm learners={dashData.learners ?? []} onPublished={loadTeacherData} />
            {reports.length ? (
              <div className="space-y-3">
                {reports.slice(0, 6).map((report) => (
                  <RowCard key={report.id} icon={IconReports} tone="mint">
                    <div className="ic-list-body">
                      <p className="ic-list-title">{report.title}</p>
                      <p className="ic-list-meta">
                        {report.learnerName} · {report.periodLabel} · {report.publishedAt ? 'Published' : 'Draft'}
                      </p>
                    </div>
                    <div className="ic-list-actions">
                      {report.publishedAt ? (
                        <button type="button" onClick={() => navigate(`/reports/${report.id}`)} className="ic-btn-soft">
                          Open
                        </button>
                      ) : (
                        <StatusPill tone="warn">Draft</StatusPill>
                      )}
                    </div>
                  </RowCard>
                ))}
              </div>
            ) : null}
          </Panel>
          ) : null}

          {activeTab === 'quizzes' ? (
          <Panel
            title="Quizzes"
            subtitle="Open a draft, publish to the class, or review who has submitted and how they scored."
            icon={IconQuizzes}
            tone="purple"
          >
            {dashData.recentQuizzes.length === 0 ? (
              <EmptyState>No quizzes yet. Upload a PDF and choose Create quiz from Study materials.</EmptyState>
            ) : (
              <div className="space-y-3">
                {dashData.recentQuizzes.map((quiz) => (
                  <RowCard key={quiz.id} icon={IconQuizzes} tone="purple">
                    <div className="ic-list-body">
                      <button
                        type="button"
                        onClick={() => navigate(`/quizzes/${quiz.id}`)}
                        className="text-left"
                      >
                        <h3 className="ic-list-title">{quiz.title}</h3>
                        <p className="ic-list-meta">
                          {quiz.className || quiz.class_name || 'Class'} · {quiz.subjectName || quiz.subject_name || 'Subject'} · {quiz.questionCount ?? 0} questions
                          {quiz.learnerTemplate ? ` · ${String(quiz.learnerTemplate).replace('_', ' ')}` : ''}
                          {` · Due ${formatDueDate(quiz.dueDate || quiz.due_date)}`}
                          {quiz.status === 'published'
                            ? ` · ${quiz.submissionCount ?? 0} submitted${quiz.averageScore != null ? ` · avg ${quiz.averageScore}%` : ''}`
                            : ''}
                        </p>
                      </button>
                    </div>
                    <div className="ic-list-actions">
                      <StatusPill tone={quiz.status === 'published' ? 'ok' : 'warn'}>{quiz.status}</StatusPill>
                      <button type="button" onClick={() => navigate(`/quizzes/${quiz.id}`)} className="ic-btn-primary text-sm">
                        {quiz.status === 'published' ? 'Results / edit' : 'Open draft'}
                      </button>
                      <button type="button" onClick={() => deleteQuiz(quiz.id)} className="ic-btn-danger">
                        Delete
                      </button>
                    </div>
                  </RowCard>
                ))}
              </div>
            )}
          </Panel>
          ) : null}

          {activeTab === 'overview' ? (
            <QuickStart
              items={[
                { id: 'materials', label: 'Study Materials', hint: 'Upload and manage PDFs for your classes', icon: IconMaterials, tone: 'teal', onClick: () => selectTab('materials') },
                FEATURES.homework
                  ? { id: 'homework', label: 'Homework', hint: 'Assign tasks and track learner progress', icon: IconHomework, tone: 'blue', onClick: () => selectTab('homework') }
                  : null,
                { id: 'quizzes', label: 'Quizzes', hint: 'Create and manage interactive quizzes', icon: IconQuizzes, tone: 'purple', onClick: () => selectTab('quizzes') },
                { id: 'messages', label: 'Write to Parents', hint: 'Send updates and messages to parents', icon: IconMessages, tone: 'orange', onClick: () => selectTab('messages') },
                FEATURES.termReports
                  ? { id: 'reports', label: 'Term Reports', hint: 'Generate and review term performance reports', icon: IconReports, tone: 'mint', onClick: () => selectTab('reports') }
                  : null,
              ].filter(Boolean)}
            />
          ) : null}
        </>
      )}

      {markingHomework ? (
        <HomeworkMarkingPanel
          homework={markingHomework}
          onClose={() => setMarkingHomework(null)}
          onSaved={loadTeacherData}
        />
      ) : null}

      {selectedMaterial ? (
        <div className="ic-modal-backdrop">
          <div className="ic-modal">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-teal-600 font-semibold">Extracted text</p>
                <h3 className="font-scribble text-2xl text-slate-900 mt-1 tracking-wide">{selectedMaterial.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedMaterial(null)} className="text-slate-500">Close</button>
            </div>
            <pre className="mt-6 max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm text-slate-700">{selectedMaterial.extractedText || 'No text could be extracted from this PDF.'}</pre>
          </div>
        </div>
      ) : null}

      {quizDraft ? (
        <div className="ic-modal-backdrop">
          <div className="ic-modal space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-600 font-semibold">Quiz builder</p>
                <h3 className="font-scribble text-2xl text-slate-900 mt-1 tracking-wide">{quizDraft.material.title}</h3>
              </div>
              <button type="button" onClick={() => setQuizDraft(null)} className="text-slate-500">Close</button>
            </div>

            {quizWarning ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">{quizWarning}</div> : null}

            {!quizDraft.quiz ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    value={quizDraft.title}
                    onChange={(event) => setQuizDraft((current) => ({ ...current, title: event.target.value }))}
                    className="md:col-span-3 rounded-lg border border-teal-200 bg-teal-50/40 px-4 py-3 text-slate-800"
                    placeholder="Quiz title"
                  />
                  <label className="block text-sm text-slate-600 md:col-span-1">
                    <span className="mb-1 block font-semibold text-slate-700">Due date (optional)</span>
                    <input
                      type="date"
                      value={quizDraft.dueDate || ''}
                      onChange={(event) => setQuizDraft((current) => ({ ...current, dueDate: event.target.value }))}
                      className="w-full rounded-lg border border-teal-200 bg-white px-4 py-3 text-slate-800"
                    />
                  </label>
                  {!quizDraft.material.classId ? (
                    <select
                      value={quizDraft.classId || ''}
                      onChange={(event) => setQuizDraft((current) => ({ ...current, classId: event.target.value }))}
                      className="rounded-lg border border-teal-200 bg-white px-4 py-3 text-slate-800"
                    >
                      <option value="">Class</option>
                      {dashData.classes.map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                      ))}
                    </select>
                  ) : null}
                  {!quizDraft.material.subjectId ? (
                    <select
                      value={quizDraft.subjectId || ''}
                      onChange={(event) => setQuizDraft((current) => ({ ...current, subjectId: event.target.value }))}
                      className="rounded-lg border border-teal-200 bg-white px-4 py-3 text-slate-800"
                    >
                      <option value="">Subject</option>
                      {dashData.subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  ) : null}
                </div>

                <QuizScopePicker
                  materials={materials}
                  value={quizDraft.scope}
                  disabled={generatingQuiz}
                  onChange={(scope) => setQuizDraft((current) => ({ ...current, scope }))}
                />

                <AiQuizOptions
                  value={quizDraft.ai}
                  minQuestions={AI_MIN_QUESTIONS}
                  disabled={generatingQuiz}
                  onChange={(ai) => setQuizDraft((current) => ({ ...current, ai }))}
                />

                <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-800">How should this quiz look for learners?</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {LEARNER_TEMPLATE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-xl border bg-white px-4 py-3 text-sm ${
                          quizDraft.learnerTemplate === option.value ? 'border-teal-500 ring-2 ring-teal-200' : 'border-teal-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name="draft-template"
                          className="mr-2"
                          checked={quizDraft.learnerTemplate === option.value}
                          onChange={() => setQuizDraft((current) => ({ ...current, learnerTemplate: option.value }))}
                        />
                        <span className="font-semibold text-slate-800">{option.label}</span>
                        <p className="mt-1 text-xs text-slate-500">{option.hint}</p>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={generateQuiz} disabled={generatingQuiz} className="rounded-lg bg-teal-500 px-5 py-3 font-semibold text-white disabled:opacity-60">
                    {generatingQuiz ? 'Generating…' : 'Generate with AI from material'}
                  </button>
                  <button type="button" onClick={startManualQuiz} disabled={generatingQuiz} className="rounded-lg border border-sky-300 bg-sky-50 px-5 py-3 font-semibold text-sky-800 disabled:opacity-60">
                    Write questions manually
                  </button>
                </div>
                {generatingQuiz && generatingStatus ? (
                  <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800" aria-live="polite">
                    {generatingStatus}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-5">
                <label className="block text-sm text-slate-600 max-w-xs">
                  <span className="mb-1 block font-semibold text-slate-700">Due date (optional)</span>
                  <input
                    type="date"
                    value={quizDraft.dueDate || ''}
                    onChange={(event) => setQuizDraft((current) => ({ ...current, dueDate: event.target.value }))}
                    className="w-full rounded-lg border border-teal-200 bg-white px-4 py-3 text-slate-800"
                  />
                </label>

                <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Learner template</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {LEARNER_TEMPLATE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-xl border bg-white px-4 py-3 text-sm ${
                          quizDraft.learnerTemplate === option.value ? 'border-teal-500 ring-2 ring-teal-200' : 'border-teal-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name="draft-template-edit"
                          className="mr-2"
                          checked={quizDraft.learnerTemplate === option.value}
                          onChange={() => setQuizDraft((current) => ({ ...current, learnerTemplate: option.value }))}
                        />
                        <span className="font-semibold text-slate-800">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {(quizDraft.quiz.questions ?? []).map((question, index) => (
                  <div key={question.id || index} className="rounded-2xl border border-teal-200 bg-teal-50/30 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Question {index + 1}</p>
                      <div className="flex items-center gap-3">
                        <select
                          value={question.difficulty || 'medium'}
                          onChange={(event) => updateDraftQuestion(index, 'difficulty', event.target.value)}
                          className="rounded-lg border border-teal-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                        >
                          {DIFFICULTY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="text-xs font-semibold text-rose-600"
                          onClick={() => setQuizDraft((current) => ({
                            ...current,
                            quiz: { ...current.quiz, questions: current.quiz.questions.filter((_, questionIndex) => questionIndex !== index) },
                          }))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {question.topic ? <p className="text-xs text-slate-500">From: {question.topic}</p> : null}
                    <input
                      value={question.questionText}
                      onChange={(event) => updateDraftQuestion(index, 'questionText', event.target.value)}
                      className="w-full rounded-lg border border-teal-200 bg-white px-4 py-3 text-slate-800"
                    />
                    {(question.options || []).map((option, optionIndex) => (
                      <label key={`${question.id}-${optionIndex}`} className="flex items-center gap-3 text-sm text-slate-700">
                        <input
                          type="radio"
                          name={`correct-${index}`}
                          checked={question.correctAnswer === option}
                          onChange={() => updateDraftQuestion(index, 'correctAnswer', option)}
                        />
                        <input
                          value={option}
                          onChange={(event) => updateDraftQuestion(index, `option-${optionIndex}`, event.target.value)}
                          className="flex-1 rounded-lg border border-teal-200 bg-white px-3 py-2 text-slate-800"
                        />
                      </label>
                    ))}
                  </div>
                ))}

                <AiRegeneratePanel
                  currentCount={quizDraft.quiz.questions?.length || quizDraft.ai.questionCount}
                  difficultyMix={quizDraft.ai.difficultyMix}
                  busy={generatingQuiz}
                  onRegenerate={regenerateDraftQuestions}
                />

                <AiHistoryPanel quizId={quizDraft.quiz.id} refreshKey={quizDraft.historyKey} />

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuizDraft((current) => ({
                        ...current,
                        quiz: {
                          ...current.quiz,
                          questions: [...(current.quiz.questions || []), {
                            ...blankQuestion((current.quiz.questions?.length || 0) + 1),
                            questionText: `Question ${(current.quiz.questions?.length || 0) + 1}`,
                            options: ['Option A', 'Option B', 'Option C', 'Option D'],
                            correctAnswer: 'Option A',
                          }],
                        },
                        mode: 'manual',
                      }));
                    }}
                    className="rounded-lg border border-teal-300 bg-white px-5 py-3 font-semibold text-teal-700"
                  >
                    Add manual question
                  </button>
                  <button type="button" onClick={saveAndPublish} disabled={publishing} className="rounded-lg bg-teal-500 px-5 py-3 font-semibold text-white disabled:opacity-60">
                    {publishing ? 'Publishing…' : 'Save and publish to class'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
