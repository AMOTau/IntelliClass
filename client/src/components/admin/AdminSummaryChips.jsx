export default function AdminSummaryChips({ counts }) {
  return (
    <div className="summary-grid">
      <div className="summary-chip">Teachers: {counts.teachers}</div>
      <div className="summary-chip">Learners: {counts.learners}</div>
      <div className="summary-chip">Parents: {counts.parents}</div>
      <div className="summary-chip">Classes: {counts.classes}</div>
      <div className="summary-chip">Subjects: {counts.subjects}</div>
    </div>
  );
}
