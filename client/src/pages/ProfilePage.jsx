import { useEffect, useState } from 'react';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

export default function ProfilePage() {
  const { user, signOut, updateUser } = useAuthSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function refreshProfile() {
      try {
        const { data } = await api.get('/users/profile');
        updateUser(data.user);
      } catch (requestError) {
        setError(parseApiError(requestError, 'Failed to load profile.'));
      }
    }

    refreshProfile();
  }, [updateUser]);

  async function handleRefresh() {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/users/profile');
      updateUser(data.user);
    } catch (requestError) {
      setError(parseApiError(requestError, 'Failed to refresh profile.'));
    } finally {
      setLoading(false);
    }
  }

  const roleIcons = {
    admin: '👨‍💼',
    teacher: '👨‍🏫',
    learner: '👨‍🎓',
    parent: '👨‍👩‍👧',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-950 to-blue-950 border-b border-teal-500/20 text-white shadow-xl">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-2xl">📚</span>
                <p className="text-teal-400 text-sm font-semibold">IntelliClass</p>
              </div>
              <h1 className="text-4xl font-bold">Welcome, {user?.firstName}</h1>
              <p className="text-gray-400 mt-2">You are signed in as a {user?.role}.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-800 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh Profile'}
              </button>
              <button
                onClick={signOut}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-5xl mx-auto px-6 py-4 mt-4">
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {/* Profile Card */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-xl p-8">
          <div className="flex items-start gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center">
                <span className="text-5xl">{roleIcons[user?.role] || '👤'}</span>
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-6">Profile Details</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div>
                  <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase">Full Name</label>
                  <p className="text-white text-lg font-medium">
                    {user?.firstName} {user?.lastName}
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase">Email</label>
                  <p className="text-white text-lg font-medium break-all">{user?.email}</p>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase">Role</label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{roleIcons[user?.role] || '👤'}</span>
                    <span className="text-white text-lg font-medium capitalize">{user?.role}</span>
                  </div>
                </div>

                {/* Join Date */}
                <div>
                  <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase">Member Since</label>
                  <p className="text-white text-lg font-medium">
                    {new Date(user?.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* User ID */}
              <div className="mt-6 pt-6 border-t border-teal-500/30">
                <label className="block text-gray-400 text-sm font-semibold mb-2 uppercase">User ID</label>
                <p className="text-gray-300 text-sm font-mono bg-slate-800/50 px-4 py-2 rounded border border-teal-500/20 break-all">
                  {user?.id}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-8 pt-8 border-t border-teal-500/30 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Account Status</p>
              <p className="text-teal-400 font-semibold">Active</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Authorization</p>
              <p className="text-teal-400 font-semibold">Full Access</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Platform</p>
              <p className="text-teal-400 font-semibold">IntelliClass</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
