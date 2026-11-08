import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandMark from './BrandMark';
import { formatDueDate } from '../utils/dates';

const notificationStyles = {
  assigned: 'border-teal-200 bg-teal-50 text-teal-900',
  due_soon: 'border-amber-200 bg-amber-50 text-amber-900',
  overdue: 'border-rose-200 bg-rose-50 text-rose-800',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  graded: 'border-sky-200 bg-sky-50 text-sky-900',
  report: 'border-violet-200 bg-violet-50 text-violet-900',
  message: 'border-teal-300 bg-white text-slate-800',
  quiz_completed: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

/**
 * Thin landing-style navbar used across dashboards.
 * Pass either onSignOut (authenticated) or showLogin (public pages).
 * Pass notifications (an array) to show the parent bell.
 */
export default function AppNavBar({ onSignOut, showLogin = false, notifications = null, onOpenNotifications }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const items = notifications ?? [];
  const unread = items.filter((item) => item.unread).length;
  const count = unread || items.length;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      onOpenNotifications?.();
    }
  }

  return (
    <nav
      className="relative flex-shrink-0"
      style={{ zIndex: 50, boxShadow: '0 10px 24px rgba(31, 92, 77, 0.08)' }}
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-left bg-no-repeat"
          style={{ backgroundImage: "url('/NavBar.jpg')" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(247,243,234,0.88) 0%, rgba(255,253,248,0.94) 18%, rgba(255,253,248,0.7) 42%, rgba(31,92,77,0.18) 100%)',
          }}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[#1f5c4d]" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark size={36} />
          <span className="font-scribble text-xl text-slate-900 tracking-wide">
            Intelli<span className="text-teal-600">Class</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {notifications ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={toggle}
                aria-label={count ? `${count} notifications` : 'Notifications'}
                aria-expanded={open}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-teal-700 text-teal-800 hover:bg-teal-50/80 transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
                  <path d="M10 21a2 2 0 0 0 4 0" />
                </svg>
                {count > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold leading-5 text-center">
                    {count > 9 ? '9+' : count}
                  </span>
                ) : null}
              </button>

              {open ? (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-y-auto rounded-2xl border border-teal-200 bg-white shadow-xl">
                  <div className="px-4 py-3 border-b border-teal-100">
                    <p className="font-scribble text-lg text-slate-900 tracking-wide">For you</p>
                    <p className="text-xs text-slate-500">Notes from school about your child.</p>
                  </div>
                  {items.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-500">Nothing new just now. You are up to date.</p>
                  ) : (
                    <ul className="p-3 space-y-2">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (item.href) {
                                setOpen(false);
                                navigate(item.href);
                              }
                            }}
                            className={`w-full text-left rounded-xl border px-3 py-3 ${notificationStyles[item.type] || notificationStyles.assigned} ${item.href ? 'hover:brightness-95' : ''}`}
                          >
                            <p className="text-sm font-semibold leading-snug">{item.message}</p>
                            {item.detail ? <p className="text-xs mt-2 leading-relaxed opacity-90 whitespace-pre-wrap">{item.detail}</p> : null}
                            <p className="text-xs mt-1 opacity-80">
                              {[item.childName, item.subject, item.dueDate ? `Due ${formatDueDate(item.dueDate)}` : null]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {showLogin ? (
            <Link
              to="/login"
              className="inline-flex items-center bg-transparent border-2 border-teal-700 text-teal-800 hover:bg-teal-50/80 font-semibold text-sm px-4 py-1.5 rounded-lg transition"
            >
              Login
            </Link>
          ) : null}
          {onSignOut ? (
            <>
              <Link
                to="/profile"
                className="hidden sm:inline-flex items-center bg-transparent border-2 border-teal-800/70 text-teal-900 hover:bg-white/70 font-semibold text-sm px-4 py-1.5 rounded-lg transition"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center bg-transparent border-2 border-teal-800 text-teal-900 hover:bg-white/70 font-semibold text-sm px-4 py-1.5 rounded-lg transition"
              >
                Sign Out
              </button>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
