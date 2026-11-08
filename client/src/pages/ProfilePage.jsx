import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell, {
  AlertBanner,
  PageHeader,
} from '../components/ui/DashboardShell';
import {
  FieldIcon,
  FormActions,
  FormCard,
  FormField,
  FormHelpCard,
  FormStep,
  FormSubmitButton,
} from '../components/ui/FormKit';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { dashboardPathForRole, tabsForRole } from '../utils/dashNav';
import { parseApiError } from '../utils/errors';

const roleCopy = {
  admin: 'Office',
  teacher: 'Staff desk',
  learner: 'Learner desk',
  parent: 'Parent desk',
};

export default function ProfilePage() {
  const { user, signOut, updateUser } = useAuthSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [notice, setNotice] = useState('');

  const dashboardPath = dashboardPathForRole(user?.role);
  const navTabs = tabsForRole(user?.role);

  function goDashboardTab(id) {
    navigate(`${dashboardPath}${id === 'overview' ? '' : `?tab=${id}`}`);
  }

  useEffect(() => {
    async function refreshProfile() {
      try {
        const { data } = await api.get('/users/profile');
        updateUser(data.user);
        setPhone(data.user.phone || '');
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

  async function handleSavePhone(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.put('/users/profile', { phone });
      updateUser(data.user);
      setNotice('Saved. This number is included when you write to parents.');
    } catch (requestError) {
      setError(parseApiError(requestError, 'Could not save your number.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell
      onSignOut={signOut}
      variant={user?.role === 'learner' ? 'learner' : 'default'}
      tabs={navTabs}
      activeTab=""
      onTabChange={goDashboardTab}
    >
      <button type="button" onClick={() => goDashboardTab('overview')} className="ic-btn-ghost text-sm mb-4">
        ← Back to dashboard
      </button>

      <PageHeader
        kicker={roleCopy[user?.role] || 'Account'}
        title={`${user?.firstName} ${user?.lastName}`}
        subtitle={`Signed in as ${user?.role}. This is the school register card for your account.`}
        doodle={false}
        actions={(
          <button type="button" onClick={handleRefresh} disabled={loading} className="ic-btn-ghost text-sm">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      />

      <AlertBanner>{error}</AlertBanner>
      <AlertBanner tone="ok">{notice}</AlertBanner>

      <div className="fk-layout fk-layout--split">
        <FormCard>
          <FormStep step={1} title="Profile details">
            <div className="fk-grid fk-grid--2">
              <FormField label="Full name" icon={FieldIcon.person}>
                <input value={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()} readOnly />
              </FormField>
              <FormField label="Role" icon={FieldIcon.school}>
                <input value={user?.role || ''} readOnly className="capitalize" />
              </FormField>
              <FormField label="Email" icon={FieldIcon.mail} className="fk-span-2">
                <input value={user?.email || ''} readOnly />
              </FormField>
              <FormField label="Member since" icon={FieldIcon.calendar} className="fk-span-2">
                <input
                  value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  readOnly
                />
              </FormField>
            </div>
          </FormStep>

          {user?.role === 'teacher' ? (
            <form onSubmit={handleSavePhone}>
              <FormStep step={2} title="Phone (parents can call you)">
                <FormField label="Phone number" icon={FieldIcon.phone}>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="e.g. 082 000 0000"
                  />
                </FormField>
              </FormStep>
              <FormActions>
                <span />
                <FormSubmitButton disabled={loading} busyLabel="Saving…">
                  Save number
                </FormSubmitButton>
              </FormActions>
            </form>
          ) : null}
        </FormCard>

        <aside className="fk-aside">
          <FormHelpCard
            items={
              user?.role === 'teacher'
                ? [
                    'Your phone number is shared when you write to parents.',
                    'Keep your email up to date with the school office.',
                    'Use Refresh if details look out of date.',
                  ]
                : [
                    'Profile details come from the school register.',
                    'Ask the office if your name or email needs changing.',
                  ]
            }
          />
        </aside>
      </div>
    </DashboardShell>
  );
}
