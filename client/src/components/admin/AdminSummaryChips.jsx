/*
  This renders inside the "Records" tab, directly above
  AdminRecordsPanel. The main dashboard already shows a large KPI
  row with the same counts, so this is styled as a compact, secondary
  recap line rather than a second set of big cards — avoids looking
  like a duplicate of the same information.
*/

function SummaryChip({ label, value }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/15 bg-slate-900/50 px-3 py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-semibold text-teal-300">{value}</span>
    </div>
  );
}

export default function AdminSummaryChips({ counts }) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      <SummaryChip label="Teachers" value={counts.teachers} />
      <SummaryChip label="Learners" value={counts.learners} />
      <SummaryChip label="Parents" value={counts.parents} />
      <SummaryChip label="Classes" value={counts.classes} />
      <SummaryChip label="Subjects" value={counts.subjects} />
    </div>
  );
}