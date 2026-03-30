import { Alert, Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { getDefaultPathByRole } from '@shared/lib/routing/getDefaultPathByRole';

export const TgAuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { exchangeTelegramToken, isAuthenticated, session } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && session) {
      navigate(getDefaultPathByRole(session.roleId), { replace: true });
    }
  }, [isAuthenticated, navigate, session]);

  useEffect(() => {
    const token = searchParams.get('token')?.trim() ?? '';
    if (!token) {
      setErrorMessage('Отсутствует Telegram-токен авторизации.');
      return;
    }

    let cancelled = false;
    void exchangeTelegramToken(token)
      .then((nextSession) => {
        if (!cancelled) {
          navigate(getDefaultPathByRole(nextSession.roleId), { replace: true });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Не удалось войти через Telegram.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [exchangeTelegramToken, navigate, searchParams]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Paper sx={{ p: 4, width: { xs: '100%', sm: 520 } }}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h5" fontWeight={700}>Telegram-вход</Typography>
          {errorMessage ? (
            <Alert severity="error" sx={{ width: '100%' }}>
              {errorMessage}
            </Alert>
          ) : (
            <>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Выполняем авторизацию через Telegram.
              </Typography>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};
