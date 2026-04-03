export default function AdminCreateSubjectForm({ form, onFieldChange, onSubmit, loading }) {
  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <label>
        Subject name
        <input value={form.name} onChange={(event) => onFieldChange('name', event.target.value)} required />
      </label>
      <label>
        Code
        <input value={form.code} onChange={(event) => onFieldChange('code', event.target.value)} />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Subject'}
      </button>
    </form>
  );
}
