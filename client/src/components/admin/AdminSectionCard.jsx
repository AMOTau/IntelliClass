export default function AdminSectionCard({ title, children, className = '' }) {
  return (
    <article className={`section-card ${className}`.trim()}>
      <h2>{title}</h2>
      {children}
    </article>
  );
}
