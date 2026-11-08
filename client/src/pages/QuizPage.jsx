import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AiHistoryPanel from '../components/AiHistoryPanel';
import AiRegeneratePanel from '../components/AiRegeneratePanel';
import LearnerQuizPlay, { LEARNER_TEMPLATE_OPTIONS } from '../components/LearnerQuizPlay';
import QuizResultsReview from '../components/QuizResultsReview';
import DashboardShell, {
  AlertBanner,
  EmptyState,
  PageHeader,
  StatusPill,
} from '../components/ui/DashboardShell';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { dashboardPathForRole, tabsForRole } from '../utils/dashNav';
import { formatDueDate } from '../utils/dates';
import { parseApiError } from '../utils/errors';
import { DIFFICULTY_OPTIONS } from '../utils/quizDifficulty';

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

export default function QuizPage() {
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuthSession();
  const reviewLearnerId = searchParams.get('learnerId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submissionResult, setSubmissionResult] = useState(null);
  const [explanations, setExplanations] = useState({});
  const [explainingId, setExplainingId] = useState('');
  const [draftQuestions, setDraftQuestions] = useState([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTemplate, setDraftTemplate] = useState('classic');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [notice, setNotice] = useState('');
  const [historyKey, setHistoryKey] = useState(0);

  const dashboardPath = dashboardPathForRole(user?.role);
  const navTabs = tabsForRole(user?.role);
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  function goDashboardTab(id) {
    navigate(`${dashboardPath}${id === 'overview' ? '' : `?tab=${id}`}`);
  }

  const shellProps = {
    onSignOut: signOut,
    variant: user?.role === 'learner' ? 'learner' : 'default',
    tabs: navTabs,
    activeTab: 'quizzes',
    onTabChange: goDashboardTab,
  };

  useEffect(() => {
    loadQuiz();
  }, [quizId, reviewLearnerId]);

  async function loadQuiz() {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get(`/quizzes/${quizId}`, {
        params: reviewLearnerId ? { learnerId: reviewLearnerId } : undefined,
      });
      setQuizData(data.quiz);
      setDraftTitle(data.quiz.title);
      setDraftTemplate(data.quiz.learnerTemplate || 'classic');
      setDraftDueDate(data.quiz.dueDate || '');
      setDraftQuestions(data.quiz.questions ?? []);
      setSubmissionResult(data.quiz.submission ?? null);
      if (data.quiz.submission?.results) {
        seedInstantExplanations(data.quiz.submission.results);
      }
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load quiz.'));
    } finally {
      setLoading(false);
    }
  }

  const isTeacherReview = Boolean(quizData && canManage);
  const isParentReview = Boolean(quizData && user?.role === 'parent');
  const isLearnerView = Boolean(quizData && user?.role === 'learner');
  const quizPastDue = Boolean(quizData?.pastDue);
  const canTakeQuiz = quizData && user?.role === 'learner' && quizData.status === 'published' && !submissionResult && !quizPastDue;
  const showResultsReview = Boolean(submissionResult) && (isParentReview || isLearnerView);
  const questionCount = useMemo(() => quizData?.questions?.length ?? 0, [quizData]);

  async function handleSubmitQuiz(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const { data } = await api.post(`/quizzes/${quizId}/submit`, { answers });
      const nextResult = {
        score: data.score,
        correctCount: data.correctCount,
        totalQuestions: data.totalQuestions,
        results: data.results,
      };
      setSubmissionResult(nextResult);
      seedInstantExplanations(data.results);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to submit quiz.'));
    } finally {
      setSaving(false);
    }
  }

  function buildQuestionPayload() {
    return draftQuestions.map((question, index) => ({
      questionText: question.questionText,
      options: question.options,
      correctAnswer: question.correctAnswer || question.options?.[0] || '',
      explanation: question.explanation,
      difficulty: question.difficulty,
      topic: question.topic,
      questionOrder: index + 1,
    }));
  }

  async function handleSaveChanges() {
    setPublishing(true);
    setError('');
    setNotice('');

    try {
      const { data } = await api.put(`/quizzes/${quizId}`, {
        title: draftTitle,
        learnerTemplate: draftTemplate,
        dueDate: draftDueDate || null,
        questions: buildQuestionPayload(),
      });
      setQuizData((current) => ({ ...current, ...data.quiz }));
      setDraftDueDate(data.quiz.dueDate || '');
      setDraftQuestions(data.quiz.questions ?? []);
      setNotice(data.quiz.status === 'published'
        ? 'Changes saved. Learners will see the updated quiz.'
        : 'Draft saved.');
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to save quiz.'));
    } finally {
      setPublishing(false);
    }
  }

  async function handleSaveAndPublish() {
    setPublishing(true);
    setError('');
    setNotice('');

    try {
      await api.put(`/quizzes/${quizId}`, {
        title: draftTitle,
        learnerTemplate: draftTemplate,
        dueDate: draftDueDate || null,
        questions: buildQuestionPayload(),
      });
      const { data } = await api.post(`/quizzes/${quizId}/publish`);
      setQuizData({
        ...data.quiz,
        learnerTemplate: draftTemplate,
        questions: data.quiz.questions ?? draftQuestions,
      });
      setDraftDueDate(data.quiz.dueDate || draftDueDate || '');
      setNotice(
        data.quiz.dueDate
          ? `Quiz published. Learners should complete it by ${formatDueDate(data.quiz.dueDate)}.`
          : 'Quiz published. Learners in the class can take it now.'
      );
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to publish quiz.'));
    } finally {
      setPublishing(false);
    }
  }

  async function handleRegenerate({ questionCount, difficultyMix, instructions, mode }) {
    setRegenerating(true);
    setError('');
    setNotice('');

    try {
      // Save edits first so "Add more" keeps them and the AI avoids repeating them.
      await api.put(`/quizzes/${quizId}`, {
        title: draftTitle,
        learnerTemplate: draftTemplate,
        dueDate: draftDueDate || null,
        questions: buildQuestionPayload(),
      });
      const { data } = await api.post('/ai/regenerate-quiz', {
        quizId,
        questionCount,
        difficultyMix,
        instructions,
        mode,
      });
      setQuizData((current) => ({ ...current, ...data.quiz }));
      setDraftTitle(data.quiz.title);
      setDraftTemplate(data.quiz.learnerTemplate || draftTemplate);
      setDraftQuestions(data.quiz.questions ?? []);
      setHistoryKey((current) => current + 1);
      setNotice(mode === 'append'
        ? `${data.addedCount} new question(s) added. Review them, then save.`
        : 'New questions generated from the study material. Review them, then save.');
      setQuizWarningSafe(data.warning);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to regenerate questions.'));
    } finally {
      setRegenerating(false);
    }
  }

  function setQuizWarningSafe(warning) {
    if (warning) {
      setNotice((current) => [current, warning].filter(Boolean).join(' '));
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this quiz for everyone? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await api.delete(`/quizzes/${quizId}`);
      navigate(dashboardPath);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to delete quiz.'));
      setDeleting(false);
    }
  }

  function seedInstantExplanations(results) {
    const seeded = {};
    (results || []).forEach((result) => {
      if (result.isCorrect || !result.questionId) {
        return;
      }
      const why = String(result.explanation || '').trim()
        || `The notes point to “${result.correctAnswer}” for this question.`;
      seeded[result.questionId] = {
        explanation: [
          `Good try! “${result.selectedAnswer || 'No answer'}” was not the best fit.`,
          `The correct answer is “${result.correctAnswer}”.`,
          why,
        ].join(' '),
        studySuggestion: result.topic
          ? `Re-read “${result.topic}” in your notes, then say the main idea in one sentence.`
          : 'Re-read the matching part of your notes, then try a similar question.',
        source: 'instant',
      };
    });
    setExplanations(seeded);
  }

  async function explainAnswer(questionId, { enrichWithAi = false } = {}) {
    setExplainingId(questionId);
    setError('');

    try {
      const { data } = await api.post('/ai/explain-answer', { quizId, questionId, enrichWithAi });
      setExplanations((current) => ({ ...current, [questionId]: data }));
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load explanation.'));
    } finally {
      setExplainingId('');
    }
  }

  function updateDraftQuestion(index, field, value) {
    setDraftQuestions((current) =>
      current.map((question, questionIndex) => {
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
      })
    );
  }

  function addManualQuestion() {
    setDraftQuestions((current) => [...current, blankQuestion(current.length + 1)]);
  }

  function removeQuestion(index) {
    setDraftQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index));
  }

  if (loading) {
    return (
      <DashboardShell {...shellProps}>
        <EmptyState>Opening the quiz…</EmptyState>
      </DashboardShell>
    );
  }

  if (error && !quizData) {
    return (
      <DashboardShell {...shellProps}>
        <AlertBanner>{error}</AlertBanner>
        <button type="button" onClick={() => goDashboardTab('quizzes')} className="ic-btn-primary">
          Back to quizzes
        </button>
      </DashboardShell>
    );
  }

  if (!quizData) {
    return null;
  }

  return (
    <DashboardShell {...shellProps}>
      {showResultsReview ? (
        <>
          <AlertBanner>{error}</AlertBanner>
          <QuizResultsReview
            title={quizData.title}
            className={quizData.className}
            subjectName={quizData.subjectName}
            childName={isParentReview
              ? [quizData.reviewLearner?.firstName, quizData.reviewLearner?.lastName].filter(Boolean).join(' ')
              : `${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
            teacherName={quizData.teacherName}
            takenAt={submissionResult.submittedAt}
            score={submissionResult.score}
            correctCount={submissionResult.correctCount}
            totalQuestions={submissionResult.totalQuestions}
            results={submissionResult.results || []}
            explanations={explanations}
            explainingId={explainingId}
            onExplain={isLearnerView ? (questionId) => explainAnswer(questionId, { enrichWithAi: true }) : undefined}
            onBack={() => goDashboardTab('quizzes')}
            onMessageTeacher={isParentReview ? () => goDashboardTab('notes') : undefined}
            viewer={isParentReview ? 'parent' : 'learner'}
          />
        </>
      ) : (
        <>
      <PageHeader
        kicker="Quiz"
        title={quizData.title}
        subtitle={`${quizData.className || 'Class'} · ${quizData.subjectName || 'Subject'}${quizData.reviewLearner ? ` · ${quizData.reviewLearner.firstName} ${quizData.reviewLearner.lastName}` : ''} · Due ${formatDueDate(quizData.dueDate)}`}
        doodle={false}
        actions={(
          <button type="button" onClick={() => goDashboardTab('quizzes')} className="ic-btn-ghost text-sm">
            Back to quizzes
          </button>
        )}
      />

      <AlertBanner>{error}</AlertBanner>
      <AlertBanner tone="ok">{notice}</AlertBanner>
      {quizPastDue && user?.role === 'learner' && !submissionResult ? (
        <AlertBanner>This quiz is past its due date and can no longer be submitted.</AlertBanner>
      ) : null}

      <div className="ic-compose flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <StatusPill tone="teal">{questionCount} questions</StatusPill>
        <StatusPill tone={quizData.status === 'published' ? 'ok' : 'warn'}>{quizData.status}</StatusPill>
        {quizData.dueDate ? (
          <StatusPill tone={quizPastDue ? 'warn' : 'mint'}>Due {formatDueDate(quizData.dueDate)}</StatusPill>
        ) : null}
        {quizData.learnerTemplate ? (
          <StatusPill tone="purple">{quizData.learnerTemplate.replace('_', ' ')}</StatusPill>
        ) : null}
      </div>
        </>
      )}

      {showResultsReview ? null : (
        <>
        {isTeacherReview ? (
          <div className="space-y-5">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              className="w-full rounded-lg border border-teal-200 bg-white px-4 py-3 text-slate-800 shadow-sm"
              placeholder="Quiz title"
            />

            <label className="block text-sm text-slate-600 max-w-xs">
              <span className="mb-1 block font-semibold text-slate-700">Due date (optional)</span>
              <input
                type="date"
                value={draftDueDate}
                onChange={(event) => setDraftDueDate(event.target.value)}
                className="w-full rounded-lg border border-teal-200 bg-white px-4 py-3 text-slate-800 shadow-sm"
              />
            </label>

            <div className="ic-panel space-y-3">
              <p className="text-sm font-semibold text-slate-800">Learner quiz template</p>
              <p className="text-xs text-slate-500">Teachers see a normal editor. Learners get the playful layout you pick here.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {LEARNER_TEMPLATE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-xl border px-4 py-3 text-sm ${
                      draftTemplate === option.value ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200' : 'border-teal-100 bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="learner-template"
                      className="mr-2"
                      checked={draftTemplate === option.value}
                      onChange={() => setDraftTemplate(option.value)}
                    />
                    <span className="font-semibold text-slate-800">{option.label}</span>
                    <p className="mt-1 text-xs text-slate-500">{option.hint}</p>
                  </label>
                ))}
              </div>
            </div>

            {draftQuestions.map((question, index) => (
              <section key={question.id || index} className="ic-panel space-y-3">
                <div className="flex items-center justify-between gap-3">
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
                    <button type="button" onClick={() => removeQuestion(index)} className="text-xs font-semibold text-rose-600">
                      Remove
                    </button>
                  </div>
                </div>
                {question.topic ? <p className="text-xs text-slate-500">From: {question.topic}</p> : null}
                <input
                  value={question.questionText}
                  onChange={(event) => updateDraftQuestion(index, 'questionText', event.target.value)}
                  className="w-full rounded-lg border border-teal-200 bg-teal-50/40 px-4 py-3 text-slate-800"
                  placeholder="Question text"
                />
                {(question.options || []).map((option, optionIndex) => (
                  <label key={`${question.id || index}-${optionIndex}`} className="flex items-center gap-3 text-sm">
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
                      placeholder={`Option ${optionIndex + 1}`}
                    />
                  </label>
                ))}
              </section>
            ))}

            {quizData.materialId || quizData.sourceScope?.length ? (
              <>
                <AiRegeneratePanel
                  currentCount={draftQuestions.length || 8}
                  difficultyMix={quizData.difficultyMix || 'balanced'}
                  busy={regenerating}
                  onRegenerate={handleRegenerate}
                />
                <AiHistoryPanel quizId={quizId} refreshKey={historyKey} />
              </>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={addManualQuestion} className="ic-btn-ghost text-sm">
                Add question manually
              </button>
              <button type="button" disabled={publishing} onClick={handleSaveChanges} className="ic-btn-primary text-sm disabled:opacity-60">
                {publishing ? 'Saving…' : quizData.status === 'published' ? 'Save changes for learners' : 'Save draft'}
              </button>
              {quizData.status !== 'published' ? (
                <button type="button" disabled={publishing} onClick={handleSaveAndPublish} className="ic-btn-primary text-sm disabled:opacity-60">
                  {publishing ? 'Publishing…' : 'Save and publish'}
                </button>
              ) : null}
              <button type="button" disabled={deleting} onClick={handleDelete} className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete quiz'}
              </button>
            </div>
          </div>
        ) : null}

        {canTakeQuiz ? (
          <form onSubmit={handleSubmitQuiz} className="space-y-5">
            <LearnerQuizPlay
              template={quizData.learnerTemplate || 'classic'}
              questions={quizData.questions}
              answers={answers}
              setAnswers={setAnswers}
            />
            <button type="submit" disabled={saving} className="ic-btn-primary disabled:opacity-60">
              {saving ? 'Submitting…' : 'Hand in quiz'}
            </button>
          </form>
        ) : null}

        {isParentReview && !submissionResult ? (
          <div className="space-y-5">
            <AlertBanner tone="warn">View only. Parents can see the questions, but cannot take or submit this quiz.</AlertBanner>
            {(quizData.questions || []).map((question, index) => (
              <section key={question.id || index} className="ic-panel">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Question {index + 1}</p>
                <p className="mt-2 font-semibold text-slate-800">{question.questionText}</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {(question.options || []).map((option) => (
                    <li key={option} className="rounded-lg border border-teal-100 px-3 py-2">{option}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {!canTakeQuiz && !isTeacherReview && !isParentReview && !submissionResult ? (
          <EmptyState>This quiz is not currently available for you.</EmptyState>
        ) : null}
        </>
      )}
    </DashboardShell>
  );
}
