import { useEffect, useState } from 'react';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';
import { Link } from 'react-router-dom';

export default function TeacherDashboardPage() {
  const { user, signOut } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashData, setDashData] = useState({
    classes: [],
    subjects: [],
    totalLearners: 0,
    recentMaterials: [],
    recentQuizzes: [],
    recentHomework: [],
  });

  useEffect(() => {
    loadTeacherData();
  }, []);

  async function loadTeacherData() {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/dashboard/teacher');
      setDashData(data);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }

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
              <p className="text-gray-400 mt-2">Teacher Dashboard</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Classes Taught</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">{dashData.classes.length}</p>
                </div>
                <div className="text-5xl opacity-30">📚</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Total Learners</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">{dashData.totalLearners}</p>
                </div>
                <div className="text-5xl opacity-30">👥</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase">Subjects</p>
                  <p className="text-4xl font-bold text-teal-400 mt-2">{dashData.subjects.length}</p>
                </div>
                <div className="text-5xl opacity-30">📖</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg transition">
              📤 Upload Material
            </button>
            <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg transition">
              ✍️ Create Quiz
            </button>
            <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 px-4 rounded-lg transition">
              📝 Assign Homework
            </button>
            <button
              onClick={loadTeacherData}
              className="bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Classes Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Your Classes</h2>
            {dashData.classes.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No classes assigned yet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashData.classes.map((cls) => (
                  <div key={cls.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 hover:border-teal-500/60 transition">
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

          {/* Subjects Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Your Subjects</h2>
            {dashData.subjects.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No subjects assigned yet
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {dashData.subjects.map((subject) => (
                  <div key={subject.id} className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-4 py-2 rounded-full font-semibold">
                    {subject.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Materials */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Study Materials</h2>
            {dashData.recentMaterials.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No study materials uploaded yet. Start uploading to create quizzes!
              </div>
            ) : (
              <div className="space-y-4">
                {dashData.recentMaterials.map((material) => (
                  <div key={material.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 flex justify-between items-start hover:border-teal-500/60 transition">
                    <div>
                      <h3 className="text-lg font-bold text-white">{material.title}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-400">
                        {material.subject && <p><strong>Subject:</strong> {material.subject}</p>}
                        {material.class_name && <p><strong>Class:</strong> {material.class_name}</p>}
                        <p><strong>Uploaded:</strong> {new Date(material.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2 rounded-lg transition whitespace-nowrap ml-4">
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Quizzes */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Quizzes</h2>
            {dashData.recentQuizzes.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No quizzes created yet
              </div>
            ) : (
              <div className="space-y-4">
                {dashData.recentQuizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 flex justify-between items-start hover:border-teal-500/60 transition">
                    <div>
                      <h3 className="text-lg font-bold text-white">{quiz.title}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-400">
                        <p><strong>Status:</strong> <span className={`font-semibold ${quiz.status === 'published' ? 'text-teal-400' : 'text-yellow-400'}`}>{quiz.status}</span></p>
                        {quiz.material_title && <p><strong>From Material:</strong> {quiz.material_title}</p>}
                        <p><strong>Created:</strong> {new Date(quiz.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2 rounded-lg transition whitespace-nowrap ml-4">
                      Manage
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Homework */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Recent Homework Assignments</h2>
            {dashData.recentHomework.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/20 rounded-lg p-8 text-center text-gray-400">
                No homework assignments created yet
              </div>
            ) : (
              <div className="space-y-4">
                {dashData.recentHomework.map((hw) => (
                  <div key={hw.id} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-lg p-6 flex justify-between items-start hover:border-teal-500/60 transition">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{hw.title}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-400">
                        {hw.subject && <p><strong>Subject:</strong> {hw.subject}</p>}
                        {hw.class_name && <p><strong>Class:</strong> {hw.class_name}</p>}
                        {hw.due_date && <p><strong>Due Date:</strong> {new Date(hw.due_date).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    <button className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2 rounded-lg transition whitespace-nowrap ml-4">
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
