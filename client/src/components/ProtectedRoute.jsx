import { Navigate } from 'react-router-dom';
import { useAuthSession } from '../context/AuthSessionContext';

export default function ProtectedRoute({ children }) {
  const { isAuthed } = useAuthSession();

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
