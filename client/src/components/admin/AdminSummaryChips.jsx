import { StatusPill } from '../ui/DashboardShell';

export default function AdminSummaryChips({ counts }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <StatusPill tone="teal">Teachers · {counts.teachers}</StatusPill>
      <StatusPill tone="blue">Learners · {counts.learners}</StatusPill>
      <StatusPill tone="purple">Parents · {counts.parents}</StatusPill>
      <StatusPill tone="orange">Classes · {counts.classes}</StatusPill>
      <StatusPill tone="mint">Subjects · {counts.subjects}</StatusPill>
    </div>
  );
}
