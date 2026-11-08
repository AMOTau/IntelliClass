import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppNavBar from '../AppNavBar';
import SideNav from '../SideNav';
import { useAuthSession } from '../../context/AuthSessionContext';
import { formatDueDate } from '../../utils/dates';
import { IconArrow, IconBell, IconRocket } from './DashIcons';

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

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Authenticated layout.
 * - With `tabs`: dark side nav + soft main canvas (mockup style).
 * - Without `tabs`: top AppNavBar (profile / quiz / report).
 */
export default function DashboardShell({
  children,
  variant = 'default',
  onSignOut,
  notifications,
  onOpenNotifications,
  tabs,
  activeTab,
  onTabChange,
  sideTagline = '',
  toolbarLead = null,
}) {
  const learner = variant === 'learner';
  const useSide = Array.isArray(tabs) && tabs.length > 0;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const items = notifications ?? [];
  const unread = items.filter((item) => item.unread).length;
  const count = unread || items.length;
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || '?';

  useEffect(() => {
    if (!bellOpen) {
      return undefined;
    }
    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [bellOpen]);

  if (!useSide) {
    return (
      <div className={`ic-shell ic-page ${learner ? 'ic-shell--learner' : ''}`}>
        {learner ? (
          <>
            <div className="ic-shell-learner-bg" aria-hidden="true" />
            <div className="ic-shell-learner-wash" aria-hidden="true" />
          </>
        ) : null}
        <AppNavBar
          onSignOut={onSignOut}
          notifications={notifications}
          onOpenNotifications={onOpenNotifications}
        />
        <div className="ic-rail">{children}</div>
      </div>
    );
  }

  function toggleBell() {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) {
      onOpenNotifications?.();
    }
  }

  return (
    <div className={`ic-shell ic-page ic-shell--side ${learner ? 'ic-shell--learner' : ''}`}>
      {learner ? (
        <>
          <div className="ic-shell-learner-bg" aria-hidden="true" />
          <div className="ic-shell-learner-wash" aria-hidden="true" />
        </>
      ) : (
        <div className="ic-shell-waves" aria-hidden="true" />
      )}

      {mobileOpen ? (
        <button
          type="button"
          className="ic-sidenav-scrim"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <SideNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onSignOut={onSignOut}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        tagline={sideTagline}
      />

      <div className="ic-main">
        <div className="ic-toolbar">
          <button
            type="button"
            className="ic-menu-btn"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            Menu
          </button>

          {toolbarLead}

          <div className="ic-toolbar-spacer" />

          <span className="ic-date-pill">{formatToday()}</span>

          {notifications ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={toggleBell}
                aria-label={count ? `${count} notifications` : 'Notifications'}
                aria-expanded={bellOpen}
                className="ic-toolbar-icon"
              >
                <IconBell size={18} />
                {count > 0 ? <span className="ic-toolbar-dot" /> : null}
              </button>
              {bellOpen ? (
                <div className="ic-toolbar-alerts">
                  <div className="px-3 py-2 border-b border-teal-100">
                    <p className="font-scribble text-base text-slate-900 tracking-wide">For you</p>
                    <p className="text-xs text-slate-500">Notes from school about your child.</p>
                  </div>
                  {items.length === 0 ? (
                    <p className="px-3 py-5 text-sm text-slate-500">Nothing new just now.</p>
                  ) : (
                    <ul className="p-2 space-y-2 max-h-64 overflow-y-auto">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (item.href) {
                                setBellOpen(false);
                                navigate(item.href);
                              }
                            }}
                            className={`w-full text-left rounded-xl border px-3 py-2.5 ${notificationStyles[item.type] || notificationStyles.assigned}`}
                          >
                            <p className="text-sm font-semibold leading-snug">{item.message}</p>
                            {item.detail ? (
                              <p className="text-xs mt-1.5 leading-relaxed opacity-90 whitespace-pre-wrap">{item.detail}</p>
                            ) : null}
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

          <Link to="/profile" className="ic-toolbar-avatar" aria-label="Profile">
            {initials}
          </Link>
        </div>

        <div className="ic-rail ic-rail--side">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ kicker, title, subtitle, actions, doodle }) {
  return (
    <header className="ic-header ic-header--dash">
      <div className="ic-header-copy">
        {kicker ? <p className="ic-kicker">{kicker}</p> : null}
        <h1 className="ic-title">{title}</h1>
        {subtitle ? <p className="ic-subtitle">{subtitle}</p> : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {doodle !== false ? (
        <div className="ic-doodle ic-doodle--books" aria-hidden="true">
          <p className="ic-doodle-caption">Better Learning Together</p>
        </div>
      ) : null}
    </header>
  );
}

const STAT_TONES = ['teal', 'blue', 'purple', 'orange', 'mint'];

export function StatGrid({ items }) {
  return (
    <div className="ic-stats ic-stats--cards">
      {items.map((item, index) => {
        const tone = item.tone || STAT_TONES[index % STAT_TONES.length];
        const Icon = item.icon;
        const body = (
          <>
            <div className={`ic-stat-icon ic-stat-icon--${tone}`}>
              {Icon ? <Icon size={20} /> : null}
            </div>
            <div className="ic-stat-body">
              <p className="ic-stat-label">{item.label}</p>
              <p className="ic-stat-value">{item.value}</p>
              {item.hint ? <p className="ic-stat-hint">{item.hint}</p> : null}
            </div>
            {item.onClick ? (
              <span className={`ic-stat-go ic-stat-go--${tone}`} aria-hidden="true">
                <IconArrow size={14} />
              </span>
            ) : null}
          </>
        );

        if (item.onClick) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={`ic-stat ic-stat--card ic-stat--${tone}`}
            >
              {body}
            </button>
          );
        }

        return (
          <div key={item.label} className={`ic-stat ic-stat--card ic-stat--${tone}`}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export function QuickStart({ title = 'Quick Start', items = [] }) {
  return (
    <section className="ic-quick">
      <div className="ic-quick-head">
        <span className="ic-quick-rocket"><IconRocket size={18} /></span>
        <h2 className="ic-panel-title">{title}</h2>
      </div>
      <div className="ic-quick-grid">
        {items.map((item, index) => {
          const tone = item.tone || STAT_TONES[index % STAT_TONES.length];
          const Icon = item.icon;
          return (
            <button
              key={item.id || item.label}
              type="button"
              onClick={item.onClick}
              className={`ic-quick-card ic-quick-card--${tone}`}
            >
              <span className={`ic-quick-icon ic-stat-icon--${tone}`}>
                {Icon ? <Icon size={18} /> : null}
              </span>
              <span className="ic-quick-copy">
                <span className="ic-quick-label">{item.label}</span>
                {item.hint ? <span className="ic-quick-hint">{item.hint}</span> : null}
              </span>
              <span className={`ic-stat-go ic-stat-go--${tone}`} aria-hidden="true">
                <IconArrow size={14} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="ic-doodle ic-doodle--plant" aria-hidden="true">
        <p className="ic-doodle-caption">Small steps create big progress</p>
      </div>
    </section>
  );
}

export function Panel({ title, subtitle, children, actions, icon: Icon, tone = 'teal' }) {
  return (
    <section className="ic-panel">
      {(title || actions) ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            {Icon ? (
              <span className={`ic-panel-icon ic-stat-icon--${tone}`}>
                <Icon size={18} />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? <h2 className="ic-panel-title">{title}</h2> : null}
              {subtitle ? <p className="ic-panel-copy">{subtitle}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ComposeCard({ title, children }) {
  return (
    <div className="ic-compose">
      {title ? <p className="ic-compose-title">{title}</p> : null}
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="ic-empty">{children}</div>;
}

export function AlertBanner({ tone = 'error', children }) {
  if (!children) {
    return null;
  }
  return <div className={`ic-alert ic-alert--${tone}`}>{children}</div>;
}

export function StatusPill({ tone = 'teal', children }) {
  return <span className={`ic-status ic-status--${tone}`}>{children}</span>;
}

export function RowCard({ children, tone, icon: Icon, as: Comp = 'div', className = '', ...props }) {
  return (
    <Comp className={`ic-row ic-list-item ${tone ? `ic-list-item--${tone}` : ''} ${className}`.trim()} {...props}>
      {Icon ? (
        <span className={`ic-list-icon ic-stat-icon--${tone || 'teal'}`}>
          <Icon size={18} />
        </span>
      ) : null}
      {children}
    </Comp>
  );
}
