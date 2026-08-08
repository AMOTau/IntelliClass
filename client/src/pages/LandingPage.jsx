import { Link } from 'react-router-dom';
import { useAuthSession } from '../context/AuthSessionContext';

/*
  SINGLE-VIEWPORT LAYOUT (unchanged approach)
  --------------------------------------------
  Outer wrapper locked to viewport height (100dvh, 100vh fallback) with
  overflow-hidden. Nav is a normal flex row; the content area is
  flex-1 so it always fills the remaining space, no scrolling.

  STYLE UPGRADE
  --------------
  - A faint dot-grid texture + two slow-drifting glow blobs give the
    hero some depth ("study glow" motif) without being loud.
  - Feature icons are now small glass cards (subtle border, hover
    lift) instead of bare icons floating in space.
  - Headline accent words use a teal→sky gradient instead of flat
    teal for a bit more richness.
  - Animation keyframes are defined in a plain <style> tag rather than
    Tailwind arbitrary-animation classes, so they render correctly
    regardless of Tailwind config.
  - Icon sizing is still explicit (inline width/height), not just
    Tailwind classes, for the same reliability reasons as before.
*/

const BookIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M3 5.5C3 4.67 3.67 4 4.5 4H10a2 2 0 0 1 2 2v13.5C11.4 19 9 18 4.5 18A1.5 1.5 0 0 1 3 16.5v-11Z" />
    <path d="M21 5.5c0-.83-.67-1.5-1.5-1.5H14a2 2 0 0 0-2 2v13.5c.6-.5 3-1.5 7.5-1.5A1.5 1.5 0 0 0 21 16.5v-11Z" />
  </svg>
);

const BrainIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M9.5 3.5a2.5 2.5 0 0 0-2.5 2.5v.2A2.8 2.8 0 0 0 5 8.9v.4A2.6 2.6 0 0 0 4 11.5c0 .9.4 1.7 1.1 2.2-.1.3-.1.6-.1.9a2.9 2.9 0 0 0 2.9 2.9c.2 0 .4 0 .6-.1a2.5 2.5 0 0 0 4.5-1.5V6a2.5 2.5 0 0 0-3.5-2.5Z" />
    <path d="M14.5 3.5A2.5 2.5 0 0 1 17 6v.2a2.8 2.8 0 0 1 2 2.7v.4a2.6 2.6 0 0 1 1 2.2c0 .9-.4 1.7-1.1 2.2.1.3.1.6.1.9a2.9 2.9 0 0 1-2.9 2.9c-.2 0-.4 0-.6-.1a2.5 2.5 0 0 1-4.5-1.5V6a2.5 2.5 0 0 1 3.5-2.5Z" />
    <path d="M9 9.5h1.5M9 13h1.5M13.5 9.5H15M13.5 13H15" />
  </svg>
);

const ChartIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M7 15l3.5-3.5L13 14l4.5-4.5" />
    <path d="M14 9.5h3.5V13" />
  </svg>
);

const PeopleIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="9" cy="8" r="2.6" />
    <path d="M4 19c0-2.7 2.2-4.5 5-4.5s5 1.8 5 4.5" />
    <circle cx="17" cy="7.5" r="2" />
    <path d="M15.3 12.3c1.8.2 3.7 1.6 3.7 4.2" />
  </svg>
);

/* Combined graduation-cap + open-book brand mark */
const BrandMark = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', flexShrink: 0 }}>
    <defs>
      <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#5eead4" />
        <stop offset="100%" stopColor="#0d9488" />
      </linearGradient>
    </defs>
    <path d="M8 28.5c0-1 .8-1.8 1.8-1.8 4 0 8.6.9 11.7 3.1V16.4C18.4 14.2 13.8 13.3 9.8 13.3c-1 0-1.8.8-1.8 1.8v13.4Z" fill="url(#brandGrad)" opacity="0.95" />
    <path d="M40 28.5c0-1-.8-1.8-1.8-1.8-4 0-8.6.9-11.7 3.1V16.4c3.1-2.2 7.7-3.1 11.7-3.1 1 0 1.8.8 1.8 1.8v13.4Z" fill="#e2fbf6" opacity="0.9" />
    <path d="M24 6 4 13.5 24 21l16.4-6.1v7.4h1.6v-8.2L24 6Z" fill="url(#brandGrad)" />
  </svg>
);

/* Faint dot-grid texture across the whole page — resolution-independent, no alignment risk */
const DotGrid = () => (
  <div
    className="pointer-events-none absolute inset-0"
    style={{
      zIndex: 0,
      backgroundImage: 'radial-gradient(rgba(94,234,212,0.16) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
      maskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, black 40%, transparent 90%)',
      WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, black 40%, transparent 90%)',
    }}
    aria-hidden="true"
  />
);

/* Faint background linework — sizes/opacity set inline so they can't misrender */
const BackgroundArt = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }} aria-hidden="true">
    <svg style={{ position: 'absolute', top: 72, left: -20, width: 110, height: 110, opacity: 0.06 }} viewBox="0 0 100 100" fill="none" stroke="#93c5fd" strokeWidth="1.2">
      <path d="M50 20c-8-6-20-8-30-4v45c10-4 22-2 30 4 8-6 20-8 30-4V16c-10-4-22-2-30 4Z" />
      <path d="M50 20v45" />
    </svg>
    <svg style={{ position: 'absolute', top: 28, right: 28, width: 72, height: 72, opacity: 0.06 }} viewBox="0 0 100 100" fill="none" stroke="#93c5fd" strokeWidth="1.2">
      <circle cx="50" cy="38" r="22" />
      <path d="M40 62h20M43 70h14M46 78h8" />
      <path d="M50 4v8M18 20l6 6M82 20l-6 6M8 45h8M92 45h-8" />
    </svg>
    <svg style={{ position: 'absolute', bottom: 40, right: 32, width: 100, height: 100, opacity: 0.06, transform: 'rotate(-8deg)' }} viewBox="0 0 100 100" fill="none" stroke="#5eead4" strokeWidth="1.2">
      <path d="M50 12 8 30l42 18 42-18Z" />
      <path d="M28 38v18c0 5 10 10 22 10s22-5 22-10V38" />
      <path d="M84 30v20" />
    </svg>
  </div>
);

export default function LandingPage() {
  const { isAuthed, user } = useAuthSession();

  const handleGetStarted = () => {
    if (isAuthed) {
      if (user?.role === 'admin') window.location.href = '/admin';
      else if (user?.role === 'teacher') window.location.href = '/teacher-dashboard';
      else if (user?.role === 'learner') window.location.href = '/learner-dashboard';
      else if (user?.role === 'parent') window.location.href = '/parent-dashboard';
      else window.location.href = '/profile';
    } else {
      window.location.href = '/login';
    }
  };

  const features = [
    { icon: BookIcon, title: 'Homework Management', copy: 'Create, assign and track homework in one place.' },
    { icon: BrainIcon, title: 'AI-Powered Quizzes', copy: 'Generate quizzes from study material in seconds.' },
    { icon: ChartIcon, title: 'Performance Tracking', copy: 'Monitor progress and identify areas for improvement.' },
    { icon: PeopleIcon, title: 'Parent Engagement', copy: 'Stay connected with real-time updates on learner progress.' },
  ];

  return (
    <div
      className="relative w-full bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950 overflow-hidden flex flex-col"
      style={{ height: '100dvh', minHeight: '100vh' }}
    >
      <style>{`
        @keyframes drift-a {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(24px, 18px); }
        }
        @keyframes drift-b {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-20px, -14px); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        .glow-a { animation: drift-a 10s ease-in-out infinite; }
        .glow-b { animation: drift-b 12s ease-in-out infinite; }
        .live-dot { animation: pulse-dot 2s ease-in-out infinite; }
        .feature-card { transition: transform 0.25s ease, border-color 0.25s ease, background-color 0.25s ease; }
        .feature-card:hover { transform: translateY(-3px); }
      `}</style>

      <DotGrid />
      <BackgroundArt />

      {/* Navigation */}
      <nav className="flex-shrink-0 bg-slate-950/80 backdrop-blur-md border-b border-teal-500/10" style={{ zIndex: 50 }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <BrandMark size={28} />
            <span className="text-lg font-bold text-white tracking-tight">
              Intelli<span className="text-teal-400">Class</span>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/login" className="text-slate-200 hover:text-teal-400 transition font-medium text-sm">
              Login
            </Link>
            <button
              onClick={handleGetStarted}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-4 py-1.5 rounded-lg transition text-sm"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="relative flex-1 flex flex-col justify-center items-center px-6 min-h-0" style={{ zIndex: 10 }}>
        <div
          className="absolute rounded-full bg-teal-500/10 glow-a"
          style={{ top: '8%', right: '6%', width: 300, height: 300, filter: 'blur(90px)', zIndex: -1 }}
        />
        <div
          className="absolute rounded-full bg-sky-500/10 glow-b"
          style={{ bottom: '4%', left: '6%', width: 220, height: 220, filter: 'blur(90px)', zIndex: -1 }}
        />

        {/* Hero */}
        <div className="flex flex-col items-center text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/5 px-3 py-1 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 live-dot" />
            <span className="text-[11px] font-medium text-teal-300 tracking-wide uppercase">
              AI-Powered Academic Platform
            </span>
          </div>

          <BrandMark size={40} />

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mt-3 mb-2 leading-tight tracking-tight">
            Learn{' '}
            <span className="bg-gradient-to-r from-teal-300 to-sky-300 bg-clip-text text-transparent">
              Smarter
            </span>
            . Teach{' '}
            <span className="bg-gradient-to-r from-teal-300 to-sky-300 bg-clip-text text-transparent">
              Better
            </span>
            .{' '}
            <span className="bg-gradient-to-r from-teal-300 to-sky-300 bg-clip-text text-transparent">
              Together
            </span>
            .
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-xl">
            The all-in-one platform that empowers teachers, engages learners, and
            keeps parents informed.
          </p>

          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-300 hover:to-teal-400 text-slate-950 font-bold px-6 py-2.5 rounded-lg transition transform hover:scale-105 text-sm sm:text-base shadow-lg shadow-teal-500/30 mt-4 group"
          >
            <span>Get Started</span>
            <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-5xl mt-6 sm:mt-8">
          {features.map(({ icon: Icon, title, copy }) => (
            <div
              key={title}
              className="feature-card flex flex-col items-center text-center px-3 py-4 rounded-2xl border border-teal-400/10 bg-white/[0.02] hover:border-teal-400/30 hover:bg-white/[0.04]"
            >
              <div
                style={{ width: 44, height: 44 }}
                className="flex-shrink-0 rounded-full border border-teal-400/40 bg-teal-500/10 flex items-center justify-center"
              >
                <span className="text-teal-300">
                  <Icon size={18} />
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-teal-300 mt-2 mb-1">{title}</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 leading-snug hidden sm:block">{copy}</p>
            </div>
          ))}
        </div>

        <p className="text-teal-400/50 text-xs mt-4 sm:mt-5 tracking-wide">
          Empowering education. Building futures.
        </p>
      </div>
    </div>
  );
}