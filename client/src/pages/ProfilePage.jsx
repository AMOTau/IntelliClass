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

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">IntelliClass</p>
          <h1>Welcome, {user?.firstName}</h1>
          <p className="lead">You are signed in as a {user?.role}.</p>
        </div>
        <div className="dashboard-actions">
          <button type="button" className="ghost" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Profile'}
          </button>
          <button type="button" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>

      <section className="profile-card">
        <h2>Profile Details</h2>
        <dl>
          <dt>Full name</dt>
          <dd>{user?.firstName} {user?.lastName}</dd>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Role</dt>
          <dd>{user?.role}</dd>
          <dt>User ID</dt>
          <dd className="mono">{user?.id}</dd>
        </dl>
        {error ? <p className="error-note">{error}</p> : null}
      </section>
    </main>
  );
}
