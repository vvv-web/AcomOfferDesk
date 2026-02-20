import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@app/providers/AuthProvider';

const schema = z.object({
    login: z.string().min(1, 'Введите логин'),
    password: z.string().min(1, 'Введите пароль')
});

type LoginFormValues = z.infer<typeof schema>;

export const AuthPage = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated, session } = useAuth();
    const [searchParams] = useSearchParams();
    const tgToken = searchParams.get('token')?.trim() ?? '';
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
        if (tgToken || !isAuthenticated || !session) {
            return;
        }
           const target = session.roleId === 1 ? '/admin' : '/requests';
        navigate(target, { replace: true });
    }, [isAuthenticated, navigate, session, tgToken]);

    const onSubmit = async (values: LoginFormValues) => {
        setErrorMessage(null);
        try {
            const nextSession = await login({ ...values, token: tgToken || undefined });
            const target = nextSession.roleId === 1 ? '/admin' : '/requests';
            navigate(target, { replace: true });
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
                    width: { xs: '90%', sm: 420 },
                    borderRadius: 3,
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    padding: { xs: 4, sm: 6 }
                })}
            >
                <Stack spacing={4} alignItems="center" component="form" onSubmit={handleSubmit(onSubmit)}>
                    <Stack spacing={1} alignItems="center">
                        <Typography variant="h5" fontWeight={600} color="text.primary">
                            Вход в систему
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Используйте логин и пароль для авторизации в веб-сервисе.
                        </Typography>
                    </Stack>
                    <Stack spacing={2.5} width="100%" alignItems="center">
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
                    </Stack>
                    <Button
                        variant="outlined"
                        type="submit"
                        sx={(theme) => ({
                            width: '100%',
                            borderRadius: 999,
                            textTransform: 'none',
                            backgroundColor: theme.palette.background.paper,
                            paddingY: 1.3
                        })}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Вход...' : 'Войти'}
                    </Button>
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