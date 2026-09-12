import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

export default function QuizPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submissionResult, setSubmissionResult] = useState(null);
  const [explanations, setExplanations] = useState({});
  const [explainingId, setExplainingId] = useState('');
  const [draftQuestions, setDraftQuestions] = useState([]);
  const [draftTitle, setDraftTitle] = useState('');

  const dashboardPath = user?.role === 'teacher' ? '/teacher-dashboard' : user?.role === 'admin' ? '/admin' : '/learner-dashboard';

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  async function loadQuiz() {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get(`/quizzes/${quizId}`);
      setQuizData(data.quiz);
      setDraftTitle(data.quiz.title);
      setDraftQuestions(data.quiz.questions ?? []);
      setSubmissionResult(data.quiz.submission ?? null);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load quiz.'));
    } finally {
      setLoading(false);
    }
  }

  const isTeacherReview = quizData && (user?.role === 'teacher' || user?.role === 'admin') && quizData.status !== 'published';
  const canTakeQuiz = quizData && user?.role === 'learner' && quizData.status === 'published' && !submissionResult;
  const questionCount = useMemo(() => quizData?.questions?.length ?? 0, [quizData]);

  async function handleSubmitQuiz(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const { data } = await api.post(`/quizzes/${quizId}/submit`, { answers });
      setSubmissionResult({
        score: data.score,
        correctCount: data.correctCount,
        totalQuestions: data.totalQuestions,
        results: data.results,
      });
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to submit quiz.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndPublish() {
    setPublishing(true);
    setError('');

    try {
      await api.put(`/quizzes/${quizId}`, {
        title: draftTitle,
        questions: draftQuestions.map((question, index) => ({
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          difficulty: question.difficulty,
          topic: question.topic,
          questionOrder: index + 1,
        })),
      });
      const { data } = await api.post(`/quizzes/${quizId}/publish`);
      setQuizData(data.quiz);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to publish quiz.'));
    } finally {
      setPublishing(false);
    }
  }

  async function explainAnswer(questionId) {
    setExplainingId(questionId);
    setError('');

    try {
      const { data } = await api.post('/ai/explain-answer', { quizId, questionId });
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

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading quiz...</div>;
  }

  if (error && !quizData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="max-w-lg rounded-2xl border border-red-400/20 bg-slate-900 p-6">
          <p className="text-red-200">{error}</p>
          <button type="button" onClick={() => navigate(dashboardPath)} className="mt-4 rounded-lg bg-teal-500 px-4 py-2 font-semibold text-slate-950">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!quizData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950 text-white">
      <header className="border-b border-teal-500/20 bg-slate-950/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-teal-300">Quiz</p>
            <h1 className="text-2xl font-bold">{quizData.title}</h1>
            <p className="text-sm text-slate-400">{quizData.className || 'Class'} · {quizData.subjectName || 'Subject'}</p>
          </div>
          <button type="button" onClick={() => navigate(dashboardPath)} className="rounded-lg border border-teal-500/20 px-4 py-2 text-sm">
            Dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        {error ? <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-200">{error}</div> : null}

        <div className="rounded-2xl border border-teal-500/10 bg-white/[0.02] p-5 text-sm text-slate-300">
          <p>{questionCount} questions · {quizData.status}</p>
        </div>

        {submissionResult ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-6 space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-white">Score: {submissionResult.score}%</h2>
              <p className="text-slate-300">{submissionResult.correctCount} / {submissionResult.totalQuestions} correct</p>
            </div>
            {(submissionResult.results || []).map((result, index) => (
              <div key={result.questionId} className="rounded-xl border border-white/10 p-4">
                <p className="text-xs uppercase tracking-wide text-teal-300">Question {index + 1}</p>
                <p className="mt-2 font-semibold">{result.questionText}</p>
                <p className={`mt-2 text-sm ${result.isCorrect ? 'text-emerald-300' : 'text-rose-200'}`}>
                  Your answer: {result.selectedAnswer || 'Not answered'}
                </p>
                {!result.isCorrect ? <p className="text-sm text-slate-300">Correct answer: {result.correctAnswer}</p> : null}
                {!result.isCorrect ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => explainAnswer(result.questionId)}
                      disabled={explainingId === result.questionId}
                      className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                    >
                      {explainingId === result.questionId ? 'Explaining…' : explanations[result.questionId] ? 'Refresh explanation' : 'Explain this answer'}
                    </button>
                    {explanations[result.questionId] ? (
                      <div className="mt-3 text-sm text-slate-200 space-y-2">
                        <p>{explanations[result.questionId].explanation}</p>
                        <p className="text-teal-200">{explanations[result.questionId].studySuggestion}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {isTeacherReview ? (
          <div className="space-y-5">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              className="w-full rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white"
            />
            {draftQuestions.map((question, index) => (
              <section key={question.id || index} className="rounded-2xl border border-teal-500/10 p-6 space-y-3">
                <input
                  value={question.questionText}
                  onChange={(event) => updateDraftQuestion(index, 'questionText', event.target.value)}
                  className="w-full rounded-lg border border-teal-500/20 bg-slate-900/70 px-4 py-3 text-white"
                />
                {(question.options || []).map((option, optionIndex) => (
                  <label key={`${question.id}-${optionIndex}`} className="flex items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name={`correct-${index}`}
                      checked={question.correctAnswer === option}
                      onChange={() => updateDraftQuestion(index, 'correctAnswer', option)}
                    />
                    <input
                      value={option}
                      onChange={(event) => updateDraftQuestion(index, `option-${optionIndex}`, event.target.value)}
                      className="flex-1 rounded-lg border border-teal-500/20 bg-slate-900/70 px-3 py-2 text-white"
                    />
                  </label>
                ))}
              </section>
            ))}
            <button type="button" disabled={publishing} onClick={handleSaveAndPublish} className="rounded-lg bg-teal-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60">
              {publishing ? 'Publishing...' : 'Save and publish'}
            </button>
          </div>
        ) : null}

        {canTakeQuiz ? (
          <form onSubmit={handleSubmitQuiz} className="space-y-5">
            {quizData.questions.map((question, index) => (
              <section key={question.id} className="rounded-2xl border border-teal-500/10 bg-white/[0.02] p-6">
                <p className="text-xs uppercase tracking-wide text-teal-300">Question {index + 1}</p>
                <h2 className="mt-2 text-lg font-semibold">{question.questionText}</h2>
                <div className="mt-4 space-y-3">
                  {(question.options || []).map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border border-teal-500/10 px-4 py-3 text-sm hover:border-teal-400/40">
                      <input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
            <button type="submit" disabled={saving} className="rounded-lg bg-teal-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60">
              {saving ? 'Submitting...' : 'Submit quiz'}
            </button>
          </form>
        ) : null}

        {!canTakeQuiz && !isTeacherReview && !submissionResult ? (
          <div className="rounded-2xl border border-teal-500/10 p-6 text-slate-300">This quiz is not currently available for you.</div>
        ) : null}
      </main>
    </div>
  );
}
