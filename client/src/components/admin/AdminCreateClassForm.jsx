export default function AdminCreateClassForm({ form, onFieldChange, onSubmit, loading }) {
  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <label>
        Class name
        <input value={form.name} onChange={(event) => onFieldChange('name', event.target.value)} required />
      </label>
      <div className="field-grid">
        <label>
          Grade level
          <input value={form.gradeLevel} onChange={(event) => onFieldChange('gradeLevel', event.target.value)} />
        </label>
        <label>
          Academic year
          <input type="number" value={form.academicYear} onChange={(event) => onFieldChange('academicYear', event.target.value)} />
        </label>
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Class'}
      </button>
    </form>
  );
}
