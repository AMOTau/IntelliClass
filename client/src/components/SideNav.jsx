import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';
import { useAuthSession } from '../context/AuthSessionContext';
import { groupTabsBySection } from '../utils/dashNav';
import { IconSignOut, TAB_ICONS } from './ui/DashIcons';

/**
 * Dark teal school side nav — inspired by the IntelliClass staff / admin mockups.
 * tabs: [{ id, label, badge?, section? }]
 */
export default function SideNav({
  tabs = [],
  activeTab,
  onTabChange,
  onSignOut,
  mobileOpen = false,
  onCloseMobile,
  tagline = '',
}) {
  const { user } = useAuthSession();
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || '?';
  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : 'Member';
  const groups = groupTabsBySection(tabs);
  const useSections = groups.some((group) => group.section);

  function selectTab(id) {
    onTabChange?.(id);
    onCloseMobile?.();
  }

  return (
    <aside className={`ic-sidenav ${mobileOpen ? 'is-open' : ''}`}>
      <div className="ic-sidenav-watermark" aria-hidden="true" />

      <div className="ic-sidenav-brand">
        <Link to="/" className="ic-sidenav-logo" onClick={onCloseMobile}>
          <BrandMark size={30} className="ic-sidenav-logo-mark" />
          <span className="ic-sidenav-logo-copy">
            <span className="ic-sidenav-logo-text">
              Intelli<span>Class</span>
            </span>
            {tagline ? <span className="ic-sidenav-tagline">{tagline}</span> : null}
          </span>
        </Link>
        <button
          type="button"
          className="ic-sidenav-close"
          aria-label="Close menu"
          onClick={onCloseMobile}
        >
          ×
        </button>
      </div>

      <nav className="ic-sidenav-tabs" aria-label="Dashboard sections">
        {groups.map((group) => (
          <div key={group.section || 'main'} className="ic-sidenav-group">
            {useSections && group.section ? (
              <p className="ic-sidenav-section">{group.section}</p>
            ) : null}
            {group.tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.id] || TAB_ICONS.overview;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  className={`ic-sidenav-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                >
                  <span className="ic-sidenav-tab-main">
                    <span className="ic-sidenav-tab-icon"><Icon size={18} /></span>
                    <span>{tab.label}</span>
                  </span>
                  {tab.badge != null && tab.badge > 0 ? (
                    <span className="ic-sidenav-badge">{tab.badge > 9 ? '9+' : tab.badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="ic-sidenav-foot">
        <Link to="/profile" className="ic-sidenav-user" onClick={onCloseMobile}>
          <span className="ic-sidenav-avatar" aria-hidden="true">{initials}</span>
          <span className="ic-sidenav-user-copy">
            <span className="ic-sidenav-user-name">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="ic-sidenav-user-role">{roleLabel}</span>
          </span>
        </Link>
        {onSignOut ? (
          <button type="button" onClick={onSignOut} className="ic-sidenav-signout">
            <IconSignOut size={17} />
            <span>Sign Out</span>
          </button>
        ) : null}
      </div>
    </aside>
  );
}
