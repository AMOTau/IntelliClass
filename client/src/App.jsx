import { Navigate, Route, Routes } from 'react-router-dom';
import AdminRoute from './components/AdminRoute';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthSessionProvider, useAuthSession } from './context/AuthSessionContext';
import AdminDashboardPage from './pages/AdminDashboardPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import LearnerDashboardPage from './pages/LearnerDashboardPage';
import ParentDashboardPage from './pages/ParentDashboardPage';
import ProfilePage from './pages/ProfilePage';
import QuizPage from './pages/QuizPage';

function RedirectFromUnknownRoute() {
  const { user } = useAuthSession();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'teacher':
      return <Navigate to="/teacher-dashboard" replace />;
    case 'learner':
      return <Navigate to="/learner-dashboard" replace />;
    case 'parent':
      return <Navigate to="/parent-dashboard" replace />;
    default:
      return <Navigate to="/profile" replace />;
  }
}

export default function App() {
  return (
    <AuthSessionProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/teacher-dashboard"
          element={
            <ProtectedRoute>
              <TeacherDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/learner-dashboard"
          element={
            <ProtectedRoute>
              <LearnerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quizzes/:quizId"
          element={
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent-dashboard"
          element={
            <ProtectedRoute>
              <ParentDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<RedirectFromUnknownRoute />} />
      </Routes>
    </AuthSessionProvider>
  );
}
