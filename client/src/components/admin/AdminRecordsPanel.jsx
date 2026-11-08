import { EmptyState, RowCard, StatusPill } from '../ui/DashboardShell';
import { IconChildren, IconLearners, IconTeachers } from '../ui/DashIcons';

function getInitials(firstName, lastName) {
  const first = firstName?.[0] ?? '';
  const last = lastName?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

function RecordColumn({ icon: Icon, title, tone, accentLabel, records, onSelectUser }) {
  return (
    <div className="rounded-[1.35rem] border border-teal-100 bg-white shadow-[0_10px_24px_rgba(31,92,77,0.05)] overflow-hidden flex flex-col min-h-[18rem]">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-teal-100 bg-[#f7fbf9]">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`ic-list-icon ic-stat-icon--${tone}`}>
            <Icon size={16} />
          </span>
          <h3 className="ic-list-title text-lg truncate">{title}</h3>
        </div>
        <StatusPill tone={tone}>{records.length}</StatusPill>
      </div>

      <div className="flex-1 max-h-80 overflow-y-auto p-3 space-y-2">
        {records.length === 0 ? (
          <EmptyState>No {accentLabel} yet.</EmptyState>
        ) : (
          records.map((record) => (
            <RowCard
              key={record.id}
              as="button"
              type="button"
              tone={tone}
              onClick={() => onSelectUser?.(record)}
            >
              <span
                className={`ic-list-icon ic-stat-icon--${tone}`}
                style={{ width: '2rem', height: '2rem', fontSize: '0.7rem', fontWeight: 700 }}
                aria-hidden="true"
              >
                {getInitials(record.firstName, record.lastName)}
              </span>
              <div className="ic-list-body">
                <h4 className="text-sm font-semibold text-slate-800 truncate">
                  {record.firstName} {record.lastName}
                </h4>
                <p className="ic-list-meta truncate">{record.email}</p>
              </div>
              <div className="ic-list-actions">
                <span className="ic-btn-soft">Open</span>
              </div>
            </RowCard>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminRecordsPanel({ teachers, learners, parents, onSelectUser }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <RecordColumn
        icon={IconTeachers}
        title="Teachers"
        tone="teal"
        accentLabel="teachers"
        records={teachers}
        onSelectUser={onSelectUser}
      />
      <RecordColumn
        icon={IconLearners}
        title="Learners"
        tone="blue"
        accentLabel="learners"
        records={learners}
        onSelectUser={onSelectUser}
      />
      <RecordColumn
        icon={IconChildren}
        title="Parents"
        tone="purple"
        accentLabel="parents"
        records={parents}
        onSelectUser={onSelectUser}
      />
    </div>
  );
}
