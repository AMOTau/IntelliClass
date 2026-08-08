/*
  Icons and avatar helper are self-contained in this file (not shared
  imports) so this component matches AdminDashboardPage.jsx visually
  without depending on it. Icon sizing is set via explicit width/height
  attributes rather than Tailwind classes alone, for the same
  reliability reasons used elsewhere in this project.
*/

const TeacherIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="12" cy="7.5" r="3" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    <path d="M12 3.5 4 6.5l8 3 8-3-8-3Z" />
  </svg>
);

const LearnerIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.5 20c0-3.4 2.9-5.8 6.5-5.8s6.5 2.4 6.5 5.8" />
  </svg>
);

const ParentIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="9" cy="8" r="2.6" />
    <path d="M4 19c0-2.7 2.2-4.5 5-4.5s5 1.8 5 4.5" />
    <circle cx="17" cy="7.5" r="2" />
    <path d="M15.3 12.3c1.8.2 3.7 1.6 3.7 4.2" />
  </svg>
);

function getInitials(firstName, lastName) {
  const first = firstName?.[0] ?? '';
  const last = lastName?.[0] ?? '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || '?';
}

function RecordColumn({ icon: Icon, title, accentLabel, records }) {
  return (
    <div className="rounded-2xl border border-teal-500/10 bg-white/[0.02] backdrop-blur flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-teal-500/10">
        <div className="flex items-center gap-2.5">
          <div
            style={{ width: 32, height: 32 }}
            className="flex-shrink-0 rounded-lg bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-300"
          >
            <Icon size={16} />
          </div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <span className="text-xs font-medium text-teal-300 bg-teal-500/10 border border-teal-400/20 rounded-full px-2.5 py-0.5">
          {records.length}
        </span>
      </div>

      <div className="max-h-80 overflow-y-auto px-3 py-2">
        {records.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">No {accentLabel} yet.</p>
        ) : (
          <ul className="divide-y divide-teal-500/5">
            {records.map((record) => (
              <li key={record.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-teal-500/5 transition">
                <div
                  style={{ width: 32, height: 32 }}
                  className="flex-shrink-0 rounded-full bg-slate-800 border border-teal-500/20 flex items-center justify-center text-teal-300 text-[11px] font-semibold"
                >
                  {getInitials(record.firstName, record.lastName)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {record.firstName} {record.lastName}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{record.email}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminRecordsPanel({ teachers, learners, parents }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <RecordColumn icon={TeacherIcon} title="Teachers" accentLabel="teachers" records={teachers} />
      <RecordColumn icon={LearnerIcon} title="Learners" accentLabel="learners" records={learners} />
      <RecordColumn icon={ParentIcon} title="Parents" accentLabel="parents" records={parents} />
    </div>
  );
}