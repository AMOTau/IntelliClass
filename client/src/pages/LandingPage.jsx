import { Link } from 'react-router-dom';
import AppNavBar from '../components/AppNavBar';

/*
  Full-bleed hero uses /hero.png from client/public.
  Fonts: Scribble Markers (IntelliClass / subheads), Chalk Board (login heading).
*/

const BookIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M3 5.5C3 4.67 3.67 4 4.5 4H10a2 2 0 0 1 2 2v13.5C11.4 19 9 18 4.5 18A1.5 1.5 0 0 1 3 16.5v-11Z" />
    <path d="M21 5.5c0-.83-.67-1.5-1.5-1.5H14a2 2 0 0 0-2 2v13.5c.6-.5 3-1.5 7.5-1.5A1.5 1.5 0 0 0 21 16.5v-11Z" />
  </svg>
);

const BrainIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M9.5 3.5a2.5 2.5 0 0 0-2.5 2.5v.2A2.8 2.8 0 0 0 5 8.9v.4A2.6 2.6 0 0 0 4 11.5c0 .9.4 1.7 1.1 2.2-.1.3-.1.6-.1.9a2.9 2.9 0 0 0 2.9 2.9c.2 0 .4 0 .6-.1a2.5 2.5 0 0 0 4.5-1.5V6a2.5 2.5 0 0 0-3.5-2.5Z" />
    <path d="M14.5 3.5A2.5 2.5 0 0 1 17 6v.2a2.8 2.8 0 0 1 2 2.7v.4a2.6 2.6 0 0 1 1 2.2c0 .9-.4 1.7-1.1 2.2.1.3.1.6.1.9a2.9 2.9 0 0 1-2.9 2.9c-.2 0-.4 0-.6-.1a2.5 2.5 0 0 1-4.5-1.5V6a2.5 2.5 0 0 1 3.5-2.5Z" />
    <path d="M9 9.5h1.5M9 13h1.5M13.5 9.5H15M13.5 13H15" />
  </svg>
);

const ChartIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M7 15l3.5-3.5L13 14l4.5-4.5" />
    <path d="M14 9.5h3.5V13" />
  </svg>
);

const PeopleIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="9" cy="8" r="2.6" />
    <path d="M4 19c0-2.7 2.2-4.5 5-4.5s5 1.8 5 4.5" />
    <circle cx="17" cy="7.5" r="2" />
    <path d="M15.3 12.3c1.8.2 3.7 1.6 3.7 4.2" />
  </svg>
);

export default function LandingPage() {
  const features = [
    { icon: BookIcon, title: 'Study Materials', copy: 'Share class PDFs and keep revision notes in one place.' },
    { icon: BrainIcon, title: 'AI-Powered Quizzes', copy: 'Generate quizzes from study material in seconds.' },
    { icon: ChartIcon, title: 'Performance Tracking', copy: 'Monitor quiz progress and identify areas for improvement.' },
    { icon: PeopleIcon, title: 'Parent Engagement', copy: 'Stay connected with real-time updates on learner progress.' },
  ];

  return (
    <div
      className="relative w-full overflow-hidden flex flex-col"
      style={{ height: '100dvh', minHeight: '100vh' }}
    >
      <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes soft-rise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-copy { animation: fade-up 0.7s ease-out both; }
        .feature-card {
          transition: transform 0.25s ease;
          animation: soft-rise 0.55s ease-out both;
        }
        .feature-card:nth-child(1) { animation-delay: 0.15s; }
        .feature-card:nth-child(2) { animation-delay: 0.22s; }
        .feature-card:nth-child(3) { animation-delay: 0.29s; }
        .feature-card:nth-child(4) { animation-delay: 0.36s; }
        .feature-card:hover { transform: translateY(-3px); }
        .borderless-cta {
          background: transparent;
          border: none;
          box-shadow: none;
        }
        .borderless-cta:hover { color: #0f766e; }
      `}</style>

      {/* Full-size hero with light opacity only */}
      <div className="absolute inset-0" style={{ zIndex: 0 }} aria-hidden="true">
        <img
          src="/hero.png"
          alt=""
          className="h-full w-full object-cover object-center opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/35 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-white/50" />
      </div>

      <AppNavBar showLogin />

      {/* Main content — same horizontal rail as the navbar (max-w-7xl + px-6) */}
      <div className="relative flex-1 flex flex-col min-h-0" style={{ zIndex: 10 }}>
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-7xl mx-auto px-6">
            <div className="hero-copy max-w-lg">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-slate-900 leading-[1.08] tracking-tight">
                Imagine Their{' '}
                <span className="font-extrabold text-teal-600">Future</span>
              </h1>

              <p className="font-scribble mt-4 text-xl sm:text-2xl text-slate-800 tracking-wide">
                Learn Smarter. Teach Better. Together.
              </p>

              <p className="mt-3 text-base sm:text-lg font-medium text-slate-800 leading-relaxed max-w-md">
                The all-in-one platform that empowers teachers, engages learners,
                and keeps parents informed.
              </p>

              <Link
                to="/login"
                className="mt-6 inline-flex items-center gap-2 bg-transparent border-2 border-teal-800 text-teal-900 hover:bg-white/70 font-bold text-base sm:text-lg tracking-wide transition px-5 py-2.5 rounded-lg group"
              >
                <span>Get Started</span>
                <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Borderless feature row */}
        <div className="pb-8 sm:pb-10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
              {features.map(({ icon: Icon, title, copy }) => (
                <div
                  key={title}
                  className="feature-card flex flex-col items-center text-center px-2 py-3 bg-transparent"
                >
                  <span className="text-teal-600 mb-3">
                    <Icon size={44} />
                  </span>
                  <h3 className="font-scribble text-base sm:text-lg text-teal-900 mb-1 tracking-wide">{title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-snug hidden sm:block">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
