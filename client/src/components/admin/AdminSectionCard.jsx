export default function AdminSectionCard({ title, children, className = '' }) {
  return (
    <article className={`ic-panel ${className}`.trim()}>
      {title ? <h2 className="ic-panel-title mb-5 pb-4 border-b border-teal-100">{title}</h2> : null}
      {children}
    </article>
  );
}
