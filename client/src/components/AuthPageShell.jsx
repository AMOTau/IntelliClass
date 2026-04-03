export default function AuthPageShell({ title, subtitle, children }) {
  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <p className="eyebrow">IntelliClass</p>
        <h1>{title}</h1>
        <p className="lead">{subtitle}</p>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
