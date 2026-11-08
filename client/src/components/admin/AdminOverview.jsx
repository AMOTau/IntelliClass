import {
  IconArrow,
  IconClasses,
  IconLearners,
  IconRecords,
  IconSubjects,
  IconTeachers,
} from '../ui/DashIcons';

function greetingForHour(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function relativeTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const diffMs = Date.now() - time;
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function EnrolmentTrend({ learners }) {
  const points = [
    Math.max(0, learners - 5),
    Math.max(0, learners - 4),
    Math.max(0, learners - 3),
    Math.max(0, learners - 2),
    Math.max(0, learners - 1),
    Math.max(learners, 1),
  ];
  const max = Math.max(...points, 1);
  const coords = points.map((value, index) => {
    const x = 20 + index * 52;
    const y = 110 - (value / max) * 78;
    return `${x},${y}`;
  });
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point}`).join(' ');
  const months = ['Mar', 'Apr', 'May', 'Jun', 'Aug', 'Oct'];

  return (
    <svg className="admin-trend-svg" viewBox="0 0 320 140" role="img" aria-label="Learner enrolment trend">
      {[30, 55, 80, 105].map((y) => (
        <line key={y} x1="16" y1={y} x2="304" y2={y} className="admin-trend-grid" />
      ))}
      <path d={path} className="admin-trend-line" fill="none" />
      {coords.map((point, index) => {
        const [x, y] = point.split(',');
        return <circle key={point} cx={x} cy={y} r="4" className="admin-trend-dot" />;
      })}
      {months.map((month, index) => (
        <text key={month} x={20 + index * 52} y="132" className="admin-trend-label" textAnchor="middle">
          {month}
        </text>
      ))}
    </svg>
  );
}

export default function AdminOverview({
  firstName,
  counts,
  users = [],
  onSelectTab,
}) {
  const greeting = `${greetingForHour()}, ${firstName || 'Admin'}!`;
  const attentionItems = [];

  if (counts.teachers === 0) {
    attentionItems.push({
      id: 'teachers',
      message: 'No teachers on the register yet.',
      action: 'Add teacher',
      tab: 'teachers',
    });
  }
  if (counts.learners === 0) {
    attentionItems.push({
      id: 'learners',
      message: 'No learners enrolled yet.',
      action: 'Add learner',
      tab: 'learners',
    });
  }
  if (counts.parents === 0 && counts.learners > 0) {
    attentionItems.push({
      id: 'parents',
      message: 'Learners may still need a parent linked.',
      action: 'View parents',
      tab: 'parents',
    });
  }
  if (counts.classes === 0) {
    attentionItems.push({
      id: 'classes',
      message: 'No classes are set up yet.',
      action: 'View classes',
      tab: 'classes',
    });
  }
  if (attentionItems.length === 0) {
    attentionItems.push({
      id: 'ok',
      message: 'School register looks healthy right now.',
      action: 'View accounts',
      tab: 'records',
      ok: true,
    });
  }

  const recentActivity = [...users]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((person) => {
      const roleLabel = person.role === 'teacher'
        ? 'New teacher registered'
        : person.role === 'learner'
          ? 'Learner enrolled'
          : person.role === 'parent'
            ? 'Parent linked'
            : 'Account created';
      return {
        id: person.id,
        title: roleLabel,
        detail: `${person.firstName} ${person.lastName}`,
        at: person.createdAt,
        tone: person.role === 'teacher' ? 'teal' : person.role === 'learner' ? 'blue' : 'purple',
      };
    });

  const stats = [
    {
      id: 'teachers',
      label: 'Teachers',
      value: counts.teachers,
      hint: `${counts.teachers} on the register`,
      icon: IconTeachers,
      tone: 'teal',
      tab: 'teachers',
    },
    {
      id: 'learners',
      label: 'Learners',
      value: counts.learners,
      hint: counts.classes ? `Across ${counts.classes} classes` : 'Awaiting enrolment',
      icon: IconLearners,
      tone: 'blue',
      tab: 'learners',
    },
    {
      id: 'classes',
      label: 'Classes',
      value: counts.classes,
      hint: `${counts.classes} class groups`,
      icon: IconClasses,
      tone: 'purple',
      tab: 'classes',
    },
    {
      id: 'subjects',
      label: 'Subjects',
      value: counts.subjects,
      hint: 'Currently offered',
      icon: IconSubjects,
      tone: 'orange',
      tab: 'subjects',
    },
  ];

  const quickActions = [
    { id: 'teachers', label: 'Add Teacher', hint: 'Create staff & assign subjects', icon: IconTeachers, tone: 'teal' },
    { id: 'learners', label: 'Add Learner', hint: 'Link a parent at the same time', icon: IconLearners, tone: 'blue' },
    { id: 'classes', label: 'View Classes', hint: 'See active class groups', icon: IconClasses, tone: 'purple' },
    { id: 'subjects', label: 'View Subjects', hint: 'Curriculum subjects on offer', icon: IconSubjects, tone: 'orange' },
    { id: 'records', label: 'Manage Users', hint: 'Edit or delete accounts', icon: IconRecords, tone: 'mint' },
    { id: 'parents', label: 'View Parents', hint: 'Guardian accounts', icon: IconLearners, tone: 'purple' },
  ];

  return (
    <div className="admin-dash">
      <header className="admin-dash-hello">
        <div>
          <h1 className="admin-dash-title">
            {greeting}
            <span className="admin-dash-sun" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            </span>
          </h1>
          <p className="admin-dash-subtitle">
            Manage your school’s academic setup, users, classes and subjects from one place.
          </p>
        </div>
      </header>

      <div className="admin-stat-row">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`admin-stat admin-stat--${item.tone}`}
              onClick={() => onSelectTab(item.tab)}
            >
              <span className={`admin-stat-icon ic-stat-icon--${item.tone}`}>
                <Icon size={18} />
              </span>
              <span className="admin-stat-copy">
                <span className="admin-stat-label">{item.label}</span>
                <span className="admin-stat-value">{item.value}</span>
                <span className="admin-stat-hint">{item.hint}</span>
              </span>
              <span className={`ic-stat-go ic-stat-go--${item.tone}`} aria-hidden="true">
                <IconArrow size={14} />
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className="admin-stat admin-stat--alert"
          onClick={() => onSelectTab(attentionItems[0]?.tab || 'records')}
        >
          <span className="admin-stat-icon admin-stat-icon--alert">!</span>
          <span className="admin-stat-copy">
            <span className="admin-stat-label">Requires Attention</span>
            <span className="admin-stat-value">{attentionItems.filter((item) => !item.ok).length || 'All clear'}</span>
            <span className="admin-stat-hint">
              {attentionItems.filter((item) => !item.ok).length
                ? `${attentionItems.filter((item) => !item.ok).length} item${attentionItems.filter((item) => !item.ok).length === 1 ? '' : 's'} to review`
                : 'Nothing urgent'}
            </span>
          </span>
          <span className="ic-stat-go ic-stat-go--orange" aria-hidden="true">
            <IconArrow size={14} />
          </span>
        </button>
      </div>

      <div className="admin-mid-grid">
        <section className="admin-card admin-card--wide">
          <div className="admin-card-head">
            <h2 className="admin-card-title">School Overview</h2>
            <span className="admin-chip">This term</span>
          </div>
          <div className="admin-mini-stats">
            <div>
              <p className="admin-mini-label">Total Enrolment</p>
              <p className="admin-mini-value">{counts.learners}</p>
            </div>
            <div>
              <p className="admin-mini-label">Active Teachers</p>
              <p className="admin-mini-value">{counts.teachers}</p>
            </div>
            <div>
              <p className="admin-mini-label">Active Classes</p>
              <p className="admin-mini-value">{counts.classes}</p>
            </div>
            <div>
              <p className="admin-mini-label">Subjects</p>
              <p className="admin-mini-value">{counts.subjects}</p>
            </div>
          </div>
          <p className="admin-card-kicker">Learner Enrolment Trend</p>
          <EnrolmentTrend learners={counts.learners} />
        </section>

        <section className="admin-card">
          <div className="admin-card-head">
            <h2 className="admin-card-title">Recent Activity</h2>
          </div>
          {recentActivity.length === 0 ? (
            <p className="admin-empty">No recent account activity yet.</p>
          ) : (
            <ul className="admin-activity">
              {recentActivity.map((item) => (
                <li key={item.id} className="admin-activity-item">
                  <span className={`admin-activity-dot admin-activity-dot--${item.tone}`} />
                  <div>
                    <p className="admin-activity-title">{item.title}</p>
                    <p className="admin-activity-detail">{item.detail}</p>
                  </div>
                  <span className="admin-activity-time">{relativeTime(item.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="admin-bottom-grid">
        <section className="admin-card">
          <div className="admin-card-head">
            <h2 className="admin-card-title">Needs Attention</h2>
          </div>
          <ul className="admin-attention">
            {attentionItems.map((item) => (
              <li key={item.id} className={`admin-attention-item ${item.ok ? 'is-ok' : ''}`}>
                <span className="admin-attention-mark" aria-hidden="true">{item.ok ? 'OK' : '!'}</span>
                <p>{item.message}</p>
                <button type="button" className="admin-link" onClick={() => onSelectTab(item.tab)}>
                  {item.action}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-card">
          <div className="admin-card-head">
            <h2 className="admin-card-title">Quick Actions</h2>
          </div>
          <div className="admin-quick-grid">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-quick admin-quick--${item.tone}`}
                  onClick={() => onSelectTab(item.id)}
                >
                  <span className={`admin-quick-icon ic-stat-icon--${item.tone}`}>
                    <Icon size={16} />
                  </span>
                  <span className="admin-quick-copy">
                    <span className="admin-quick-label">{item.label}</span>
                    <span className="admin-quick-hint">{item.hint}</span>
                  </span>
                  <span className={`ic-stat-go ic-stat-go--${item.tone}`} aria-hidden="true">
                    <IconArrow size={12} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <p className="admin-footer-banner">
        Better administration. A stronger school. A brighter future.
      </p>
    </div>
  );
}
