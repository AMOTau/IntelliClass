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
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/profile'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });
      signIn(data.token, data.user);
      navigate(data.user.role === 'admin' ? '/admin' : '/profile');
    } catch (requestError) {
      setError(parseApiError(requestError, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell
      title="Sign in to IntelliClass"
      subtitle="Accounts are provisioned by administrators for teachers, learners, parents, and admins."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error ? <p className="error-note">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <p className="auth-switch">Need access? Contact your school administrator for account setup.</p>
      <p className="auth-switch">
        <Link to="/">Back to home</Link>
      </p>
    </AuthPageShell>
  );
}
