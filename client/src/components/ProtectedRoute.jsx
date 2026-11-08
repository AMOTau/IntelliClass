import { Navigate } from 'react-router-dom';
import { useAuthSession } from '../context/AuthSessionContext';
import { dashboardPathForRole } from '../utils/dashNav';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthed, user } = useAuthSession();

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  const allowed = Array.isArray(roles) ? roles : [];
  if (allowed.length && !allowed.includes(user?.role)) {
    return <Navigate to={dashboardPathForRole(user?.role)} replace />;
  }

  return children;
}
