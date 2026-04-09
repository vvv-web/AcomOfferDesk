import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@app/providers/AuthProvider';
import { getDefaultPathByRole } from '@shared/lib/routing/getDefaultPathByRole';

const legacyLoginEnabled = import.meta.env.VITE_ENABLE_LEGACY_LOGIN !== 'false';

const schema = z.object({
  login: z.string().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль')
});

type LoginFormValues = z.infer<typeof schema>;

export const AuthPage = () => {
  const navigate = useNavigate();
  const { beginLogin, beginRegistration, loginLegacy, isAuthenticated, session } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      login: '',
      password: ''
    }
  });

  useEffect(() => {
    if (!isAuthenticated || !session) {
      return;
    }
    navigate(session.businessAccess ? getDefaultPathByRole(session.roleId) : '/account', { replace: true });
  }, [isAuthenticated, navigate, session]);

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMessage(null);
    try {
      const nextSession = await loginLegacy(values);
      navigate(nextSession.businessAccess ? getDefaultPathByRole(nextSession.roleId) : '/account', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Ошибка авторизации');
    }
  };

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
        <Stack spacing={3.5}>
          <Stack spacing={1} alignItems="center" textAlign="center">
            <Typography variant="h5" fontWeight={700} color="text.primary">
              Вход в AcomOfferDesk
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Основной вход и саморегистрация выполняются через Keycloak. Роль и доступ к данным всё равно определяются приложением.
            </Typography>
          </Stack>

          <Stack spacing={1.5}>
            <Button
              variant="contained"
              onClick={() => beginLogin('/')}
              sx={{ borderRadius: 999, textTransform: 'none', py: 1.3, boxShadow: 'none' }}
            >
              Войти через Keycloak
            </Button>
            <Button
              variant="outlined"
              onClick={beginRegistration}
              sx={{ borderRadius: 999, textTransform: 'none', py: 1.2 }}
            >
              Зарегистрироваться как контрагент
            </Button>
          </Stack>

          {legacyLoginEnabled ? (
            <>
              <Divider>Legacy</Divider>
              <Stack spacing={2.5} component="form" onSubmit={handleSubmit(onSubmit)}>
                <TextField
                  fullWidth
                  label="Логин"
                  variant="outlined"
                  error={Boolean(errors.login)}
                  helperText={errors.login?.message}
                  InputProps={{
                    sx: (theme) => ({
                      borderRadius: 999,
                      backgroundColor: theme.palette.primary.light
                    })
                  }}
                  {...register('login')}
                />
                <TextField
                  fullWidth
                  label="Пароль"
                  type="password"
                  variant="outlined"
                  error={Boolean(errors.password)}
                  helperText={errors.password?.message}
                  InputProps={{
                    sx: (theme) => ({
                      borderRadius: 999,
                      backgroundColor: theme.palette.primary.light
                    })
                  }}
                  {...register('password')}
                />
                <Button
                  variant="outlined"
                  type="submit"
                  sx={{ width: '100%', borderRadius: 999, textTransform: 'none', py: 1.3 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Вход...' : 'Войти по legacy-логину'}
                </Button>
              </Stack>
            </>
          ) : null}

          {errorMessage ? (
            <Typography variant="body2" color="error" textAlign="center">
              {errorMessage}
            </Typography>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
};
