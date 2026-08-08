export default function AuthPageShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center px-4 py-8">
      {/* Decorative background elements */}
      <div className="absolute top-20 right-10 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl"></div>

      <main className="w-full max-w-md relative z-10">
        {/* Logo and Title Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="text-5xl">📚</div>
          </div>
          <div className="flex items-center justify-center space-x-2 mb-6">
            <span className="text-2xl font-bold text-white">Intelli<span className="text-teal-400">Class</span></span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          <p className="text-gray-400">{subtitle}</p>
        </div>

        {/* Form Container */}
        <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur border border-teal-500/30 rounded-lg shadow-xl p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
