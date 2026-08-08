import { useEffect, useState } from 'react';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

export default function LearnerDashboardPage() {
  const { user, signOut } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashData, setDashData] = useState({
    classes: [],
    assignedHomework: [],
    availableQuizzes: [],
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
      setDashData(data);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }

  const pendingHomework = dashData.assignedHomework.filter((hw) => {
    if (!hw.due_date) return false;
    return new Date(hw.due_date) > new Date();
  });

  const overdueHomework = dashData.assignedHomework.filter((hw) => {
    if (!hw.due_date) return false;
    return new Date(hw.due_date) <= new Date();
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-950 to-blue-950 border-b border-teal-500/20 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-2xl">📚</span>
                <p className="text-teal-400 text-sm font-semibold">IntelliClass</p>
              </div>
              <h1 className="text-4xl font-bold">Welcome, {user?.firstName}</h1>
              <p className="text-gray-400 mt-2">Learner Dashboard</p>
            </div>
            <button
              onClick={signOut}
              className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-6 py-4 mt-4">
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-white text-2xl">Loading...</div>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto px-6 py-12">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Classes</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">{dashData.classes.length}</p>
                </div>
                <div className="text-5xl opacity-30">📚</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Pending Homework</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">{pendingHomework.length}</p>
                </div>
                <div className="text-5xl opacity-30">📝</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-red-500/30 rounded-lg shadow-lg p-6 hover:border-red-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Overdue</p>
                  <p className="text-4xl font-bold text-red-400 mt-2">{overdueHomework.length}</p>
                </div>
                <div className="text-5xl opacity-30">⚠️</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Completed</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">{dashData.submissionStats.completed}</p>
                </div>
                <div className="text-5xl opacity-30">✅</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg transition">
              📖 Browse Quizzes
            </button>
            <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg transition">
              📊 View Results
            </button>
            <button
              onClick={loadLearnerData}
              className="bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Overdue Alert */}
          {overdueHomework.length > 0 && (
            <div className="mb-12 bg-red-500/20 border border-red-500/50 text-red-200 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-2">⚠️ Overdue Homework</h3>
              <p className="mb-4">You have {overdueHomework.length} overdue assignment(s). Please complete them as soon as possible!</p>
              <div className="space-y-2">
                {overdueHomework.map((hw) => (
                  <div key={hw.id} className="text-sm">
                    <strong>{hw.title}</strong> - Due: {new Date(hw.due_date).toLocaleDateString()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Your Classes */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Your Classes</h2>
            {dashData.classes.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                You are not enrolled in any classes yet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashData.classes.map((cls) => (
                  <div key={cls.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
                    <div className="text-3xl mb-3">📚</div>
                    <h3 className="text-xl font-bold text-white">{cls.name}</h3>
                    <div className="mt-4 space-y-2 text-sm text-gray-400">
                      {cls.grade_level && <p><strong>Grade:</strong> {cls.grade_level}</p>}
                      {cls.academic_year && <p><strong>Year:</strong> {cls.academic_year}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Homework */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Pending Homework</h2>
            {pendingHomework.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                ✨ No pending homework! Time to explore quizzes or study materials.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingHomework.map((hw) => (
                  <div key={hw.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">{hw.title}</h3>
                        {hw.description && (
                          <p className="text-gray-400 mt-2">{hw.description}</p>
                        )}
                        <div className="mt-4 space-y-1 text-sm text-gray-400">
                          {hw.subject && <p><strong>Subject:</strong> {hw.subject}</p>}
                          {hw.due_date && (
                            <p>
                              <strong>Due:</strong> {new Date(hw.due_date).toLocaleDateString()}
                              {new Date(hw.due_date) < new Date() && (
                                <span className="text-red-400 font-semibold"> (OVERDUE)</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2 rounded-lg transition whitespace-nowrap ml-4">
                        Submit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Quizzes */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Available Quizzes</h2>
            {dashData.availableQuizzes.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No quizzes available yet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dashData.availableQuizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">{quiz.title}</h3>
                        <p className="text-sm text-gray-400 mt-2">
                          Created: {new Date(quiz.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-3xl opacity-30">📋</div>
                    </div>
                    <button className="mt-4 w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-2 rounded-lg transition">
                      Take Quiz
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Summary */}
          <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Your Progress</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-gray-400 font-semibold mb-2">Total Submissions: {dashData.submissionStats.totalSubmissions}</p>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-teal-400 h-3 rounded-full"
                    style={{
                      width:
                        dashData.submissionStats.totalSubmissions > 0
                          ? `${(dashData.submissionStats.completed / dashData.submissionStats.totalSubmissions) * 100}%`
                          : '0%',
                    }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-teal-400">{dashData.submissionStats.completed}</p>
                <p className="text-gray-400">Completed</p>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
