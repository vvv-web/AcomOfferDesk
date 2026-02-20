import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, IconButton, Paper, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { completeTgRegistration } from '@shared/api/completeTgRegistration';

type RegistrationField = {
    label: string;
    name: keyof RegistrationFormValues;
    type?: string;
    multiline?: boolean;
    rows?: number;
};

type RegistrationStep = {
    subtitle: string;
    fields: RegistrationField[];
};

const stepTitles: RegistrationStep[] = [
    {
        subtitle: 'Придумайте данные для входа',
        fields: [
            { label: 'Логин', name: 'login' },
            { label: 'Пароль', name: 'password', type: 'password' },
            { label: 'Повторите пароль', name: 'password_confirm', type: 'password' }
        ]
    },
    {
        subtitle: 'Введите личные данные для связи',
        fields: [
            { label: 'ФИО', name: 'full_name' },
            { label: 'Телефон', name: 'phone' },
            { label: 'Электронная почта', name: 'mail' }
        ]
    },
    {
        subtitle: 'Введите юридические данные компании',
        fields: [
            { label: 'ИНН', name: 'inn' },
            { label: 'Наименование', name: 'company_name' },
            { label: 'Телефон', name: 'company_phone' },
            { label: 'Электронная почта', name: 'company_mail' },
            { label: 'Адрес', name: 'address' },
            { label: 'Дополнительная информация', name: 'note', multiline: true, rows: 3 }
        ]
    }
];

const normalizePhone = (value: string) => value.replace(/\D/g, '');
const byteLength = (value: string) => new TextEncoder().encode(value).length;
const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const schema = z
    .object({
        login: z.string().min(3, 'Минимум 3 символа').max(128, 'Максимум 128 символов'),
        password: z
            .string()
            .min(6, 'Минимум 6 символов')
            .max(72, 'Максимум 72 символа')
            .refine((value) => byteLength(value) <= 72, 'Пароль слишком длинный (до 72 байт)'),
        password_confirm: z
            .string()
            .min(6, 'Минимум 6 символов')
            .max(72, 'Максимум 72 символа')
            .refine((value) => byteLength(value) <= 72, 'Пароль слишком длинный (до 72 байт)'),
        full_name: z.string().min(1, 'Введите ФИО').max(256, 'Максимум 256 символов'),
        phone: z
            .string()
            .min(1, 'Введите телефон')
            .max(64, 'Максимум 64 символа')
            .refine((value) => {
                const normalized = normalizePhone(value);
                return normalized.length === 11 && (normalized.startsWith('7') || normalized.startsWith('8'));
            }, 'Некорректный телефон'),
        mail: z
            .string()
            .min(1, 'Введите email')
            .max(256, 'Максимум 256 символов')
            .refine((value) => emailRegex.test(value), 'Некорректный email'),
        company_name: z.string().min(1, 'Введите наименование').max(256, 'Максимум 256 символов'),
        inn: z
            .string()
            .min(1, 'Введите ИНН')
            .max(32, 'Максимум 32 символа')
            .regex(/^\d{10}$|^\d{12}$/, 'Некорректный ИНН'),
        company_phone: z
            .string()
            .min(1, 'Введите телефон')
            .max(64, 'Максимум 64 символа')
            .refine((value) => {
                const normalized = normalizePhone(value);
                return normalized.length === 11 && (normalized.startsWith('7') || normalized.startsWith('8'));
            }, 'Некорректный телефон'),
        company_mail: z
            .string()
            .max(256, 'Максимум 256 символов')
            .optional()
            .refine((value) => !value || value === 'Не указано' || emailRegex.test(value), 'Некорректный email'),
        address: z.string().max(256, 'Максимум 256 символов').optional(),
        note: z.string().max(1024, 'Максимум 1024 символа').optional()
    })
    .refine((data) => data.password === data.password_confirm, {
        message: 'Пароли не совпадают',
        path: ['password_confirm']
    });

type RegistrationFormValues = z.infer<typeof schema>;

const stepFields: Array<Array<keyof RegistrationFormValues>> = [
    ['login', 'password', 'password_confirm'],
    ['full_name', 'phone', 'mail'],
    ['inn', 'company_name', 'company_phone', 'company_mail', 'address', 'note']
];

export const TgRegisterPage = () => {
    const [searchParams] = useSearchParams();
    const hasToken = Boolean(searchParams.get('token'));
    const [step, setStep] = useState(0);
    const currentStep = useMemo(() => stepTitles[step], [step]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        trigger,
        reset
    } = useForm<RegistrationFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            login: '',
            password: '',
            password_confirm: '',
            full_name: '',
            phone: '',
            mail: '',
            company_name: '',
            inn: '',
            company_phone: '',
            company_mail: '',
            address: '',
            note: ''
        }
    });

    const handleNext = async () => {
        const fields = stepFields[step];
        const isValid = await trigger(fields, { shouldFocus: true });
        if (!isValid) {
            return;
        }
        setStep((prev) => Math.min(prev + 1, stepTitles.length - 1));
    };

    const handleBack = () => {
        setStep((prev) => Math.max(prev - 1, 0));
    };

    const onSubmit = async (values: RegistrationFormValues) => {
        const token = searchParams.get('token');
        if (!token) {
            setErrorMessage('Ссылка недействительна. Перейдите по ссылке из Telegram-бота.');
            return;
        }
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            await completeTgRegistration({
                token,
                login: values.login,
                password: values.password,
                password_confirm: values.password_confirm,
                full_name: values.full_name,
                phone: values.phone,
                mail: values.mail,
                company_name: values.company_name,
                inn: values.inn,
                company_phone: values.company_phone,
                company_mail: values.company_mail?.trim() ? values.company_mail : 'Не указано',
                address: values.address?.trim() ? values.address : 'Не указано',
                note: values.note?.trim() ? values.note : 'Не указано'
            });
            setSuccessMessage('Данные отправлены. Мы свяжемся с вами после проверки.');
            reset();
            setStep(0);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Не удалось отправить данные регистрации');
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
                    borderRadius: 4,
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    padding: { xs: 4, sm: 6 }
                })}
            >
                <Stack spacing={4} alignItems="center" component="form" onSubmit={handleSubmit(onSubmit)}>
                    <Stack width="100%" spacing={2} alignItems="center">
                        <Stack width="100%" direction="row" justifyContent="space-between" alignItems="center">
                            {step > 0 && hasToken ? (
                                <IconButton
                                    aria-label="Назад"
                                    onClick={handleBack}
                                    sx={{ padding: 0, color: 'text.primary' }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path
                                            d="M15 6L9 12L15 18"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </IconButton>
                            ) : (
                                <span />
                            )}
                            <Typography variant="body2" color="text.secondary">
                                шаг {step + 1} / {stepTitles.length}
                            </Typography>
                        </Stack>
                        <Stack spacing={1} alignItems="center">
                            <Typography variant="h5" fontWeight={600} color="text.primary">
                                Регистрация
                            </Typography>
                            <Typography variant="body2" color="text.secondary" textAlign="center">
                                {currentStep.subtitle}
                            </Typography>
                        </Stack>
                    </Stack>

                    {!hasToken ? (
                        <Typography variant="body2" color="error" textAlign="center">
                            Ссылка недействительна. Пожалуйста, перейдите по ссылке из Telegram-бота.
                        </Typography>
                    ) : (
                        <Stack spacing={2.5} width="100%" alignItems="center">
                            {currentStep.fields.map((field) => (
                                <TextField
                                    key={field.label}
                                    fullWidth
                                    label={field.label}
                                    type={field.type ?? 'text'}
                                    variant="outlined"
                                    multiline={Boolean(field.multiline)}
                                    rows={field.rows}
                                    error={Boolean(errors[field.name])}
                                    helperText={errors[field.name]?.message}
                                    InputProps={{
                                        sx: (theme) => ({
                                            borderRadius: field.multiline ? 3 : 999,
                                            backgroundColor: theme.palette.primary.light
                                        })
                                    }}
                                    {...register(field.name)}
                                />
                            ))}
                            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
                            <Button
                                variant="outlined"
                                onClick={step === stepTitles.length - 1 ? undefined : handleNext}
                                type={step === stepTitles.length - 1 ? 'submit' : 'button'}
                                disabled={isSubmitting}
                                sx={(theme) => ({
                                    width: '100%',
                                    borderRadius: 999,
                                    textTransform: 'none',
                                    backgroundColor: theme.palette.background.paper,
                                    paddingY: 1.3
                                })}
                            >
                                {step === stepTitles.length - 1
                                    ? isSubmitting
                                        ? 'Отправка...'
                                        : 'Зарегистрироваться'
                                    : 'Далее'}
                            </Button>
                        </Stack>
                    )}
                </Stack>
            </Paper>
            <Snackbar
                open={Boolean(successMessage)}
                autoHideDuration={4000}
                onClose={() => setSuccessMessage(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" sx={{ width: '100%' }}>
                    {successMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};
