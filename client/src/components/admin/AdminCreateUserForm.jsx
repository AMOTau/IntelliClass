export default function AdminCreateUserForm({ form, onFieldChange, onSubmit, loading }) {
  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <div className="field-grid">
        <label>
          First name
          <input value={form.firstName} onChange={(event) => onFieldChange('firstName', event.target.value)} required />
        </label>
        <label>
          Last name
          <input value={form.lastName} onChange={(event) => onFieldChange('lastName', event.target.value)} required />
        </label>
      </div>
      <label>
        Email
        <input type="email" value={form.email} onChange={(event) => onFieldChange('email', event.target.value)} required />
      </label>
      <div className="field-grid">
        <label>
          Temporary password
          <input type="password" minLength={8} value={form.password} onChange={(event) => onFieldChange('password', event.target.value)} required />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(event) => onFieldChange('role', event.target.value)}>
            <option value="teacher">Teacher</option>
            <option value="learner">Learner</option>
            <option value="parent">Parent</option>
          </select>
        </label>
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}
