import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

const fileOrigin = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/api\/?$/, '');

export default function LearnerDashboardPage() {
  const { user, signOut } = useAuthSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashData, setDashData] = useState({
    classes: [],
    assignedHomework: [],
    availableQuizzes: [],
    studyMaterials: [],
    submissionStats: {
      totalSubmissions: 0,
      completed: 0,
    },
  });

  useEffect(() => {
    loadLearnerData();
  }, []);

  async function loadLearnerData() {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/dashboard/learner');
      setDashData({
        ...data,
        studyMaterials: data.studyMaterials ?? [],
      });
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }

  const pendingHomework = dashData.assignedHomework.filter((hw) => hw.due_date && new Date(hw.due_date) > new Date());
  const overdueHomework = dashData.assignedHomework.filter((hw) => hw.due_date && new Date(hw.due_date) <= new Date());

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950">
      <header className="bg-gradient-to-r from-slate-950 to-blue-950 border-b border-teal-500/20 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <div>
            <p className="text-teal-400 text-sm font-semibold mb-2">IntelliClass</p>
            <h1 className="text-4xl font-bold">Welcome, {user?.firstName}</h1>
            <p className="text-gray-400 mt-2">Your notes, quizzes, and results in one place.</p>
          </div>
          <button onClick={signOut} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg">
            Sign Out
          </button>
        </div>
      </header>

      {error ? (
        <div className="max-w-7xl mx-auto px-6 py-4 mt-4">
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">{error}</div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh] text-white text-2xl">Loading...</div>
      ) : (
        <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              ['Classes', dashData.classes.length, 'text-teal-400'],
              ['Pending homework', pendingHomework.length, 'text-teal-400'],
              ['Overdue', overdueHomework.length, 'text-red-400'],
              ['Completed', dashData.submissionStats.completed, 'text-teal-400'],
            ].map(([label, value, color]) => (
              <div key={label} className="bg-slate-900/50 border border-teal-500/30 rounded-lg p-6">
                <p className="text-gray-400 text-sm font-semibold uppercase">{label}</p>
                <p className={`text-4xl font-bold mt-2 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {overdueHomework.length > 0 ? (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-2">Overdue homework</h3>
              {overdueHomework.map((hw) => (
                <p key={hw.id} className="text-sm">{hw.title} — due {new Date(hw.due_date).toLocaleDateString()}</p>
              ))}
            </div>
          ) : null}

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Quizzes</h2>
            {dashData.availableQuizzes.length === 0 ? (
              <div className="rounded-lg border border-teal-500/20 p-8 text-center text-gray-400">No quizzes yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dashData.availableQuizzes.map((quiz) => (
                  <button
                    key={quiz.id}
                    type="button"
                    onClick={() => navigate(`/quizzes/${quiz.id}`)}
                    className="text-left rounded-xl border border-teal-500/30 bg-slate-900/50 p-6 hover:border-teal-400/60"
                  >
                    <h3 className="text-lg font-bold text-white">{quiz.title}</h3>
                    <p className="text-sm text-slate-400 mt-2">{quiz.subject_name || 'Subject'} · {quiz.class_name || 'Class'}</p>
                    <p className="mt-4 font-semibold text-teal-300">
                      {quiz.score != null ? `View result: ${quiz.score}%` : 'Take quiz'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Study materials</h2>
            {dashData.studyMaterials.length === 0 ? (
              <div className="rounded-lg border border-teal-500/20 p-8 text-center text-gray-400">No study materials have been shared with your class yet.</div>
            ) : (
              <div className="space-y-4">
                {dashData.studyMaterials.map((material) => (
                  <a
                    key={material.id}
                    href={`${fileOrigin}${material.fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-teal-500/30 bg-slate-900/50 p-6 hover:border-teal-400/60"
                  >
                    <h3 className="text-lg font-bold text-white">{material.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{material.subject} · {material.class_name}</p>
                  </a>
                ))}
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
