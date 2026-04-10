import { Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { getDefaultPathByRole } from '@shared/lib/routing/getDefaultPathByRole';

export const AuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { beginLogin, isAuthenticated, session, status } = useAuth();
  const nextPath = useMemo(() => {
    const raw = searchParams.get('next')?.trim();
    return raw && raw.startsWith('/') ? raw : '/';
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthenticated || !session) {
      return;
    }
    if (!session.businessAccess) {
      navigate('/account', { replace: true });
      return;
    }
    navigate(nextPath === '/' ? getDefaultPathByRole(session.roleId) : nextPath, { replace: true });
  }, [isAuthenticated, navigate, nextPath, session]);

  useEffect(() => {
    if (status !== 'anonymous') {
      return;
    }
    beginLogin(nextPath);
  }, [beginLogin, nextPath, status]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 3
      }}
    >
      <Paper
        elevation={0}
        sx={(theme) => ({
          width: { xs: '94%', sm: 460 },
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          padding: { xs: 4, sm: 5 }
        })}
      >
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography variant="h5" fontWeight={700} color="text.primary">
            Вход в AcomOfferDesk
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Перенаправляем на защищённую страницу входа.
          </Typography>
          <CircularProgress size={28} />
        </Stack>
      </Paper>
    </Box>
  );
};
