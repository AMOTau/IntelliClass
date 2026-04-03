import { Navigate } from 'react-router-dom';
import { useAuthSession } from '../context/AuthSessionContext';

export default function AdminRoute({ children }) {
  const { isAuthed, user } = useAuthSession();

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/profile" replace />;
  }

  return children;
}
