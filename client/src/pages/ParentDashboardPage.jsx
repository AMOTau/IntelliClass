import { useEffect, useState } from 'react';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

export default function ParentDashboardPage() {
  const { user, signOut } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashData, setDashData] = useState({
    children: [],
    childrenClasses: [],
    recentQuizResults: [],
  });

  useEffect(() => {
    loadParentData();
  }, []);

  async function loadParentData() {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/dashboard/parent');
      setDashData(data);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }

  const calculateAverageScore = (childId) => {
    const childResults = dashData.recentQuizResults.filter(
      (result) => result.learner_id === childId
    );
    if (childResults.length === 0) return 0;
    const total = childResults.reduce((sum, r) => sum + (r.score || 0), 0);
    return Math.round(total / childResults.length);
  };

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
              <p className="text-gray-400 mt-2">Parent Dashboard</p>
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
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Children</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">{dashData.children.length}</p>
                </div>
                <div className="text-5xl opacity-30">👨‍👩‍👧</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Classes</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">
                    {new Set(dashData.childrenClasses.map((c) => c.id)).size}
                  </p>
                </div>
                <div className="text-5xl opacity-30">📚</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Quiz Results</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">{dashData.recentQuizResults.length}</p>
                </div>
                <div className="text-5xl opacity-30">📊</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg transition">
              📋 View Reports
            </button>
            <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg transition">
              💬 Message Teacher
            </button>
            <button
              onClick={loadParentData}
              className="bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Your Children */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Your Children</h2>
            {dashData.children.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No children linked to your account yet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashData.children.map((child) => (
                  <div key={child.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
                    <div className="text-4xl mb-3">👤</div>
                    <h3 className="text-xl font-bold text-white">
                      {child.first_name} {child.last_name}
                    </h3>
                    <p className="text-sm text-gray-400 mt-2">{child.email}</p>
                    <div className="mt-6 flex space-x-2">
                      <button className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-2 px-3 rounded-lg transition text-sm">
                        View Profile
                      </button>
                      <button className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-2 px-3 rounded-lg transition text-sm">
                        Progress
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Children Classes */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Children's Enrollment</h2>
            {dashData.childrenClasses.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No class enrollment information available
              </div>
            ) : (
              <div className="space-y-4">
                {dashData.childrenClasses.map((enrollment) => (
                  <div key={`${enrollment.learner_id}-${enrollment.id}`} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-white">{enrollment.name}</h3>
                        <p className="text-sm text-gray-400 mt-2">
                          Student: {enrollment.first_name} {enrollment.last_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="bg-teal-500/30 text-teal-300 px-3 py-1 rounded-full text-sm font-semibold border border-teal-500/50">
                          Enrolled
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Quiz Results */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Quiz Performance</h2>
            {dashData.recentQuizResults.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No quiz results yet
              </div>
            ) : (
              <div className="space-y-4">
                {dashData.recentQuizResults.map((result) => (
                  <div key={result.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">
                          {result.first_name} {result.last_name}
                        </h3>
                        <p className="text-gray-300 font-semibold mt-2">{result.title}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Completed: {new Date(result.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-bold text-teal-400">{result.score}%</div>
                        <div
                          className={`text-sm font-semibold mt-2 ${
                            result.score >= 70 ? 'text-green-400' : result.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                          }`}
                        >
                          {result.score >= 70 ? '✅ Good' : result.score >= 50 ? '⚠️ Fair' : '❌ Needs Help'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dashData.children.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-8">
                <h3 className="text-xl font-bold text-white mb-6">Average Scores by Child</h3>
                <div className="space-y-4">
                  {dashData.children.map((child) => {
                    const avgScore = calculateAverageScore(child.id);
                    return (
                      <div key={child.id}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-300">
                            {child.first_name}
                          </span>
                          <span className="font-bold text-teal-400">{avgScore}%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              avgScore >= 70 ? 'bg-green-500' : avgScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${avgScore}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-8">
              <h3 className="text-xl font-bold text-white mb-6">Tips for Supporting Learning</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-xl mr-3 text-teal-400">✓</span>
                  <span>Check quiz results regularly to monitor progress</span>
                </li>
                <li className="flex items-start">
                  <span className="text-xl mr-3 text-teal-400">✓</span>
                  <span>Encourage your child to complete all assignments</span>
                </li>
                <li className="flex items-start">
                  <span className="text-xl mr-3 text-teal-400">✓</span>
                  <span>Review scores and discuss areas for improvement</span>
                </li>
                <li className="flex items-start">
                  <span className="text-xl mr-3 text-teal-400">✓</span>
                  <span>Communicate with teachers about any concerns</span>
                </li>
              </ul>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
