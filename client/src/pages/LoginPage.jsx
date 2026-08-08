import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import AuthPageShell from '../components/AuthPageShell';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthed, signIn, user } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthed) {
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'teacher') return <Navigate to="/teacher-dashboard" replace />;
    if (user?.role === 'learner') return <Navigate to="/learner-dashboard" replace />;
    if (user?.role === 'parent') return <Navigate to="/parent-dashboard" replace />;
    return <Navigate to="/profile" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });
      signIn(data.token, data.user);
      
      const navigationMap = {
        admin: '/admin',
        teacher: '/teacher-dashboard',
        learner: '/learner-dashboard',
        parent: '/parent-dashboard',
      };
      
      navigate(navigationMap[data.user.role] || '/profile');
    } catch (requestError) {
      setError(parseApiError(requestError, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell
      title="Sign In to IntelliClass"
      subtitle="Accounts are provisioned by administrators for teachers, learners, parents, and admins."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-white font-semibold mb-2">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-3 bg-slate-800/50 border border-teal-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/60 transition"
          />
        </div>

        <div>
          <label className="block text-white font-semibold mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            className="w-full px-4 py-3 bg-slate-800/50 border border-teal-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/60 transition"
          />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-6"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 space-y-3 text-center">
        <p className="text-gray-400 text-sm">Need access? Contact your school administrator for account setup.</p>
        <Link to="/" className="text-teal-400 hover:text-teal-300 font-semibold transition">
          ← Back to Home
        </Link>
      </div>
    </AuthPageShell>
  );
}
