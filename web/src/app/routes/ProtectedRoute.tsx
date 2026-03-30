import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';

export const ProtectedRoute = () => {
  const { isAuthenticated, status, session } = useAuth();

  if (status === 'bootstrapping') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (status === 'anonymous' || (!session && !isAuthenticated)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
