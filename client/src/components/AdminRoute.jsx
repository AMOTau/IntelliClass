import ProtectedRoute from './ProtectedRoute';

export default function AdminRoute({ children }) {
  return <ProtectedRoute roles={['admin']}>{children}</ProtectedRoute>;
}
