import { Link } from 'react-router-dom';
import { useAuthSession } from '../context/AuthSessionContext';

export default function LandingPage() {
  const { isAuthed, user } = useAuthSession();

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">IntelliClass</p>
          <h1>AI-assisted academic management for schools.</h1>
          <p className="lead">Sprint 2 now includes login, admin provisioning, and a dedicated admin console.</p>
          <div className="cta-row">
            <Link className="cta-link" to={isAuthed ? (user?.role === 'admin' ? '/admin' : '/profile') : '/login'}>
              {isAuthed ? 'Open Workspace' : 'Sign In'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
