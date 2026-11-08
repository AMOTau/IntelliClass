import BrandMark from './BrandMark';

export default function AuthPageShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-sky-50 to-cyan-50 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute top-20 right-10 w-96 h-96 bg-teal-300/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-10 w-72 h-72 bg-sky-300/20 rounded-full blur-3xl" />

      <main className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BrandMark size={64} />
          </div>
          <div className="flex items-center justify-center space-x-2 mb-6">
            <span className="font-scribble text-2xl text-slate-900 tracking-wide">Intelli<span className="text-teal-600">Class</span></span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-slate-500">{subtitle}</p>
        </div>

        <div className="bg-white/90 backdrop-blur border border-teal-200 rounded-2xl shadow-lg p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
