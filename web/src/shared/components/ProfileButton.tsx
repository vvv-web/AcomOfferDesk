import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Stack,
  SvgIcon,
  TextField,
  Typography
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '@app/providers/AuthProvider';
import {
  getCurrentUserProfile,
  updateMyCompanyContacts,
  updateMyCredentials,
  updateMyProfile
} from '@shared/api/getCurrentUserProfile';
import type { CurrentUserProfile } from '@shared/api/getCurrentUserProfile';
import { hasAvailableAction } from '@shared/auth/availableActions';

const fallbackText = 'Не указано';

const roundedFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 999,
    backgroundColor: '#d9d9d9'
  }
};

const defaultDbPlaceholder = 'не указано';

const isPlaceholderValue = (value: string) => value.trim().toLowerCase() === defaultDbPlaceholder;

const optionalEmail = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || isPlaceholderValue(value) || z.string().email().safeParse(value).success,
    'Введите корректный email'
  );

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Введите текущий пароль'),
    password: z.string().min(8, 'Минимум 8 символов'),
    confirmPassword: z.string().min(1, 'Повторите пароль')
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword']
  });

// profiles: full_name и phone обязательные, mail имеет default в БД
const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Введите ФИО'),
  phone: z.string().trim().min(1, 'Введите телефон'),
  mail: optionalEmail
});

// company_contacts: company_name, inn, phone обязательные,
// mail/address/note имеют default в БД
const companySchema = z.object({
  inn: z.string().trim().min(1, 'Введите ИНН'),
  company_name: z.string().trim().min(1, 'Введите наименование'),
  company_phone: z.string().trim().min(1, 'Введите телефон'),
  company_mail: optionalEmail,
  address: z.string().trim(),
  note: z.string().trim()
});

type PasswordFormValues = z.infer<typeof passwordSchema>;
type ProfileFormValues = z.infer<typeof profileSchema>;
type CompanyFormValues = z.infer<typeof companySchema>;

const ProfileIcon = () => (
  <SvgIcon fontSize="small">
    <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5Zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5Z" />
  </SvgIcon>
);

const DataRow = ({ label, value }: { label: string; value: string | null }) => (
  <Stack direction="row" spacing={2}>
    <Typography sx={{ width: 170, color: 'text.primary' }}>{label}</Typography>
    <Typography color={value ? 'text.primary' : 'text.secondary'}>{value ?? fallbackText}</Typography>
  </Stack>
);

const normalizeOptional = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || isPlaceholderValue(trimmed)) {
    return undefined;
  }
  return trimmed;
};

const sanitizeDefaultValue = (value: string | null) => (value && isPlaceholderValue(value) ? '' : value ?? '');

export const ProfileButton = () => {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [openPassword, setOpenPassword] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const [openCompany, setOpenCompany] = useState(false);
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors, isSubmitting: isSubmittingPassword },
    reset: resetPassword
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { oldPassword: '', password: '', confirmPassword: '' }
  });

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isSubmitting: isSubmittingProfile },
    reset: resetProfile
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: '', phone: '', mail: '' }
  });

  const {
    register: registerCompany,
    handleSubmit: handleCompanySubmit,
    formState: { errors: companyErrors, isSubmitting: isSubmittingCompany },
    reset: resetCompany
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { inn: '', company_name: '', company_phone: '', company_mail: '', address: '', note: '' }
  });

  useEffect(() => {
    if (!profile) {
      return;
    }

    resetProfile({
      full_name: profile.fullName ?? '',
      phone: profile.phone ?? '',
      mail: sanitizeDefaultValue(profile.mail)
    });

    resetCompany({
      inn: profile.company.inn ?? '',
      company_name: profile.company.companyName ?? '',
      company_phone: profile.company.phone ?? '',
      company_mail: sanitizeDefaultValue(profile.company.mail),
      address: sanitizeDefaultValue(profile.company.address),
      note: sanitizeDefaultValue(profile.company.note)
    });
  }, [profile, resetCompany, resetProfile]);

  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCurrentUserProfile();
      setProfile(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить профиль');
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = async () => {
    setOpen(true);
    if (isLoading || profile) {
      return;
    }
    await loadProfile();
  };

  const availableActions = useMemo(() => ({ availableActions: profile?.availableActions ?? [] }), [profile?.availableActions]);
  const showCompanyInfo = (profile?.roleId ?? session?.roleId) === 5;
  const canEditCredentials = hasAvailableAction(availableActions, '/api/v1/users/me/credentials', 'PATCH');
  const canEditProfile = hasAvailableAction(availableActions, '/api/v1/users/me/profile', 'PATCH');
  const canEditCompany = hasAvailableAction(availableActions, '/api/v1/users/me/company-contacts', 'PATCH');

  const onSubmitPassword = async (values: PasswordFormValues) => {
    setError(null);
    try {
      const nextProfile = await updateMyCredentials({
        current_password: values.oldPassword.trim(),
        new_password: values.password.trim()
      });
      setProfile(nextProfile);
      resetPassword({ oldPassword: '', password: '', confirmPassword: '' });
      setOpenPassword(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось обновить пароль');
    }
  };

  const onSubmitProfile = async (values: ProfileFormValues) => {
    setError(null);
    try {
      const nextProfile = await updateMyProfile({
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        mail: normalizeOptional(values.mail)
      });
      setProfile(nextProfile);
      setOpenProfile(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось обновить личные данные');
    }
  };

  const onSubmitCompany = async (values: CompanyFormValues) => {
    setError(null);
    try {
      const nextProfile = await updateMyCompanyContacts({
        inn: values.inn.trim(),
        company_name: values.company_name.trim(),
        company_phone: values.company_phone.trim(),
        company_mail: normalizeOptional(values.company_mail),
        address: normalizeOptional(values.address),
        note: normalizeOptional(values.note)
      });
      setProfile(nextProfile);
      setOpenCompany(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось обновить данные компании');
    }
  };

  return (
    <>
      <Button variant="outlined" onClick={() => void openDialog()} startIcon={<ProfileIcon />} sx={{ minWidth: 124 }}>
        Профиль
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        BackdropProps={{
          sx: {
            backdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(31, 42, 68, 0.35)'
          }
        }}
        PaperProps={{
          sx: {
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: '#d9d9d9',
            maxWidth: 560
          }
        }}
      >
        <DialogContent sx={{ p: 4 }}>
          {isLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : (
            <Stack spacing={2.5}>
              {error ? <Alert severity="error">{error}</Alert> : null}

              <Stack spacing={1.5}>
                <Typography variant="h5" fontWeight={700}>
                  Личные данные
                </Typography>
                <DataRow label="Логин" value={session?.login ?? profile?.userId ?? null} />
                <DataRow label="ФИО" value={profile?.fullName ?? null} />
                <DataRow label="Телефон" value={profile?.phone ?? null} />
                <DataRow label="E-mail" value={profile?.mail ?? null} />
              </Stack>

              <Stack spacing={1.25}>
                {canEditCredentials ? (
                  <Button variant="outlined" sx={{ borderRadius: 999 }} onClick={() => setOpenPassword(true)}>
                    Изменить данные входа
                  </Button>
                ) : null}
                {canEditProfile ? (
                  <Button variant="outlined" sx={{ borderRadius: 999 }} onClick={() => setOpenProfile(true)}>
                    Изменить данные для связи
                  </Button>
                ) : null}
              </Stack>

              {showCompanyInfo ? (
                <Stack spacing={1.5}>
                  <Typography variant="h5" fontWeight={700}>
                    Данные компании
                  </Typography>
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 1.5,
                      backgroundColor: 'rgba(255,255,255,0.24)'
                    }}
                  >
                    <DataRow label="ИНН" value={profile?.company.inn ?? null} />
                    <DataRow label="Наименование" value={profile?.company.companyName ?? null} />
                    <DataRow label="Телефон" value={profile?.company.phone ?? null} />
                    <DataRow label="E-mail" value={profile?.company.mail ?? null} />
                    <DataRow label="Адрес" value={profile?.company.address ?? null} />
                    <DataRow label="Доп. информация" value={profile?.company.note ?? null} />
                  </Box>
                  {canEditCompany ? (
                    <Button variant="outlined" sx={{ borderRadius: 999 }} onClick={() => setOpenCompany(true)}>
                      Изменить данные компании
                    </Button>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openPassword} onClose={() => setOpenPassword(false)} fullWidth maxWidth="xs">
        <DialogContent sx={{ p: 3, backgroundColor: '#d9d9d9' }}>
          <Stack spacing={2} component="form" onSubmit={handlePasswordSubmit((values) => void onSubmitPassword(values))}>
            <Typography variant="h5" fontWeight={700}>
              Изменение пароля
            </Typography>
            <TextField
              label="Старый пароль"
              type="password"
              {...registerPassword('oldPassword')}
              error={Boolean(passwordErrors.oldPassword)}
              helperText={passwordErrors.oldPassword?.message}
              sx={roundedFieldSx}
            />
            <TextField
              label="Новый пароль"
              type="password"
              {...registerPassword('password')}
              error={Boolean(passwordErrors.password)}
              helperText={passwordErrors.password?.message}
              sx={roundedFieldSx}
            />
            <TextField
              label="Повторите новый пароль"
              type="password"
              {...registerPassword('confirmPassword')}
              error={Boolean(passwordErrors.confirmPassword)}
              helperText={passwordErrors.confirmPassword?.message}
              sx={roundedFieldSx}
            />
            <Button type="submit" variant="outlined" sx={{ borderRadius: 999 }} disabled={isSubmittingPassword}>
              Сохранить новый пароль
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={openProfile} onClose={() => setOpenProfile(false)} fullWidth maxWidth="xs">
        <DialogContent sx={{ p: 3, backgroundColor: '#d9d9d9' }}>
          <Stack spacing={2} component="form" onSubmit={handleProfileSubmit((values) => void onSubmitProfile(values))}>
            <Typography variant="h5" fontWeight={700}>
              Личные данные
            </Typography>
            <TextField
              label="ФИО"
              {...registerProfile('full_name')}
              error={Boolean(profileErrors.full_name)}
              helperText={profileErrors.full_name?.message}
              sx={roundedFieldSx}
            />
            <TextField
              label="Телефон"
              {...registerProfile('phone')}
              error={Boolean(profileErrors.phone)}
              helperText={profileErrors.phone?.message}
              sx={roundedFieldSx}
            />
            <TextField
              label="Электронная почта"
              {...registerProfile('mail')}
              error={Boolean(profileErrors.mail)}
              helperText={profileErrors.mail?.message}
              sx={roundedFieldSx}
            />
            <Button type="submit" variant="outlined" sx={{ borderRadius: 999 }} disabled={isSubmittingProfile}>
              Сохранить изменения
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={openCompany} onClose={() => setOpenCompany(false)} fullWidth maxWidth="xs">
        <DialogContent sx={{ p: 3, backgroundColor: '#d9d9d9' }}>
          <Stack spacing={2} component="form" onSubmit={handleCompanySubmit((values) => void onSubmitCompany(values))}>
            <Typography variant="h5" fontWeight={700}>
              Юридические данные компании
            </Typography>
            <TextField
              label="ИНН"
              {...registerCompany('inn')}
              error={Boolean(companyErrors.inn)}
              helperText={companyErrors.inn?.message}
              sx={roundedFieldSx}
            />
            <TextField
              label="Наименование"
              {...registerCompany('company_name')}
              error={Boolean(companyErrors.company_name)}
              helperText={companyErrors.company_name?.message}
              sx={roundedFieldSx}
            />
            <TextField
              label="Телефон"
              {...registerCompany('company_phone')}
              error={Boolean(companyErrors.company_phone)}
              helperText={companyErrors.company_phone?.message}
              sx={roundedFieldSx}
            />
            <TextField
              label="Электронная почта"
              {...registerCompany('company_mail')}
              error={Boolean(companyErrors.company_mail)}
              helperText={companyErrors.company_mail?.message}
              sx={roundedFieldSx}
            />
            <TextField
              label="Адрес"
              {...registerCompany('address')}
              error={Boolean(companyErrors.address)}
              helperText={companyErrors.address?.message}
              sx={roundedFieldSx}
            />
            <TextField
              label="Дополнительная информация"
              multiline
              minRows={3}
              {...registerCompany('note')}
              error={Boolean(companyErrors.note)}
              helperText={companyErrors.note?.message}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, backgroundColor: '#d9d9d9' } }}
            />
            <Button type="submit" variant="outlined" sx={{ borderRadius: 999 }} disabled={isSubmittingCompany}>
              Сохранить изменения
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
};
