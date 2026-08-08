export default function AdminSectionCard({ title, children, className = '' }) {
  return (
    <article
      className={`rounded-2xl border border-teal-500/10 bg-white/[0.02] backdrop-blur p-6 sm:p-7 ${className}`.trim()}
    >
      <h2 className="text-lg font-semibold text-white mb-5 pb-4 border-b border-teal-500/10">
        {title}
      </h2>
      {children}
    </article>
  );
}