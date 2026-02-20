import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';

export const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};