import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import { useAuthSession } from '../context/AuthSessionContext';
import { api } from '../lib/api';
import { parseApiError } from '../utils/errors';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signOut } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Always show a fresh login form — never auto-enter as the previous user.
  useEffect(() => {
    signOut();
  }, [signOut]);

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
    <div className="relative min-h-screen w-full overflow-hidden">
      <style>{`
        .login-field::placeholder {
          letter-spacing: 0.08em;
        }
        #login-password.login-field::placeholder {
          letter-spacing: 0.28em;
        }
      `}</style>

      {/* Full-bleed login background — same light wash approach as landing */}
      <div className="absolute inset-0" aria-hidden="true">
        <img
          src="/Login-image.png"
          alt=""
          className="h-full w-full object-cover object-center opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/25 via-transparent to-white/30" />
      </div>

      {/* Starts just after the boy silhouette glow; left side stays open */}
      <main
        className="relative z-10 min-h-screen flex items-center pr-6 sm:pr-10 py-10"
        style={{ paddingLeft: '52%' }}
      >
        <div className="w-full max-w-[19rem] bg-transparent">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <BrandMark size={64} />
            </div>
            <p className="font-scribble text-3xl text-slate-900 tracking-wide">
              Intelli<span className="text-teal-600">Class</span>
            </p>
            <h1 className="font-chalk mt-3 text-2xl sm:text-3xl text-slate-900 tracking-wide">
              Sign In to IntelliClass
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-baseline gap-2 border-b border-teal-600/70 pb-2">
              <label htmlFor="login-email" className="shrink-0 text-slate-800 font-semibold">
                Email:
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@school.example.com"
                required
                className="login-field min-w-0 flex-1 bg-transparent border-0 outline-none ring-0 shadow-none text-slate-800 placeholder-slate-400/90 py-1 focus:outline-none focus:ring-0"
              />
            </div>

            <div className="flex items-baseline gap-2 border-b border-teal-600/70 pb-2">
              <label htmlFor="login-password" className="shrink-0 text-slate-800 font-semibold">
                Password:
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••••••••"
                required
                className="login-field min-w-0 flex-1 bg-transparent border-0 outline-none ring-0 shadow-none text-slate-800 placeholder-slate-400/90 py-1 focus:outline-none focus:ring-0"
              />
            </div>

            {error ? (
              <div className="bg-rose-50/80 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2.5 bg-transparent border border-teal-600 text-teal-700 hover:bg-teal-50/60 font-semibold py-2.5 px-5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <img
                src="/icons8-backpack-48.png"
                alt=""
                width={22}
                height={22}
                className="shrink-0"
              />
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
            </button>
          </form>

          <div className="mt-8 space-y-3 text-center">
            <p className="text-slate-700 text-sm leading-relaxed font-medium">
              Need access? Contact your school administrator for account setup.
            </p>
            <Link to="/" className="inline-block text-teal-700 hover:text-teal-600 font-semibold transition">
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
