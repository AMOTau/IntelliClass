/** Shared school-office form kit — stepped sections, icon fields, help aside. */

export function FormPage({
  kicker,
  title,
  subtitle,
  doodleCaption,
  children,
  aside,
}) {
  return (
    <div className="fk-page">
      <header className="fk-page-head">
        <div className="fk-page-copy">
          {kicker ? <p className="ic-kicker">{kicker}</p> : null}
          <h1 className="fk-page-title">{title}</h1>
          {subtitle ? <p className="fk-page-subtitle">{subtitle}</p> : null}
        </div>
        {doodleCaption ? (
          <div className="fk-doodle" aria-hidden="true">
            <div className="ic-doodle ic-doodle--books" />
            <p className="fk-doodle-caption">{doodleCaption}</p>
          </div>
        ) : null}
      </header>
      <div className={`fk-layout ${aside ? 'fk-layout--split' : ''}`}>
        <div className="fk-main">{children}</div>
        {aside ? <aside className="fk-aside">{aside}</aside> : null}
      </div>
    </div>
  );
}

export function FormCard({ children, onSubmit }) {
  const Comp = onSubmit ? 'form' : 'div';
  return (
    <Comp className="fk-card" onSubmit={onSubmit}>
      {children}
    </Comp>
  );
}

export function FormStep({ step, title, children }) {
  return (
    <section className="fk-step">
      <div className="fk-step-head">
        <span className="fk-step-badge" aria-hidden="true">{step}</span>
        <h2 className="fk-step-title">{title}</h2>
      </div>
      <div className="fk-step-body">{children}</div>
    </section>
  );
}

export function FormGrid({ children, cols = 2 }) {
  return <div className={`fk-grid fk-grid--${cols}`}>{children}</div>;
}

export function FormField({
  label,
  required,
  hint,
  icon,
  className = '',
  children,
}) {
  return (
    <label className={`fk-field ${className}`.trim()}>
      {label ? (
        <span className="fk-label">
          {label}
          {required ? <span className="fk-req" aria-hidden="true">*</span> : null}
        </span>
      ) : null}
      <span className={`fk-control ${icon ? 'fk-control--icon' : ''}`}>
        {icon ? <span className="fk-icon" aria-hidden="true">{icon}</span> : null}
        {children}
      </span>
      {hint ? <span className="fk-hint">{hint}</span> : null}
    </label>
  );
}

export function FormActions({ children }) {
  return <div className="fk-actions">{children}</div>;
}

export function FormCancelButton({ children = 'Cancel', onClick, disabled }) {
  return (
    <button type="button" className="fk-btn fk-btn--ghost" onClick={onClick} disabled={disabled}>
      <span aria-hidden="true">×</span>
      {children}
    </button>
  );
}

export function FormSubmitButton({ children, disabled, busyLabel }) {
  return (
    <button type="submit" className="fk-btn fk-btn--primary" disabled={disabled}>
      {disabled && busyLabel ? busyLabel : children}
    </button>
  );
}

export function FormHelpCard({ title = 'Quick Help', items = [] }) {
  return (
    <div className="fk-side-card">
      <h3 className="fk-side-title">{title}</h3>
      <ul className="fk-help-list">
        {items.map((item) => (
          <li key={item}>
            <span className="fk-help-check" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormStatCard({ label, value, hint }) {
  return (
    <div className="fk-side-card fk-stat-card">
      <p className="fk-stat-label">{label}</p>
      <p className="fk-stat-value">{value}</p>
      {hint ? <p className="fk-stat-hint">{hint}</p> : null}
    </div>
  );
}

export function FormPreviewCard({ title, children, className = '' }) {
  return (
    <div className={`fk-preview ${className}`.trim()}>
      <div className="fk-preview-avatar" aria-hidden="true" />
      <div>
        <p className="fk-preview-title">{title}</p>
        <div className="fk-preview-copy">{children}</div>
      </div>
    </div>
  );
}

/* Lightweight field icons */
export const FieldIcon = {
  person: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
    </svg>
  ),
  mail: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 7 9-7" />
    </svg>
  ),
  lock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  phone: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
  school: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
    </svg>
  ),
  book: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  ),
  file: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
  message: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 1 1 17 0z" />
    </svg>
  ),
};
