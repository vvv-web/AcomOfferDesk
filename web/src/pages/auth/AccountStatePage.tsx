import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import {
  getCurrentUserProfile,
  updateMyCompanyContacts,
  updateMyProfile,
  type CurrentUserProfile
} from '@shared/api/users/getCurrentUserProfile';
import { ROLE } from '@shared/constants/roles';
import { getDefaultPathByRole } from '@shared/lib/routing/getDefaultPathByRole';

type ProfileDraft = {
  fullName: string;
  phone: string;
  mail: string;
  companyName: string;
  inn: string;
  companyPhone: string;
  companyMail: string;
  address: string;
  note: string;
};

const emptyDraft: ProfileDraft = {
  fullName: '',
  phone: '',
  mail: '',
  companyName: '',
  inn: '',
  companyPhone: '',
  companyMail: '',
  address: '',
  note: ''
};

const buildDraft = (profile: CurrentUserProfile | null): ProfileDraft => ({
  fullName: profile?.fullName ?? '',
  phone: profile?.phone ?? '',
  mail: profile?.mail ?? '',
  companyName: profile?.company.companyName ?? '',
  inn: profile?.company.inn ?? '',
  companyPhone: profile?.company.phone ?? '',
  companyMail: profile?.company.mail ?? '',
  address: profile?.company.address ?? '',
  note: profile?.company.note ?? ''
});

const getStatusMessage = (status: string) => {
  if (status === 'review') {
    return 'Локальный бизнес-профиль создан и находится на проверке. Рабочий функционал откроется после перевода users.status в active.';
  }
  if (status === 'inactive') {
    return 'Доступ к приложению временно отключён. Обратитесь к администратору проекта.';
  }
  if (status === 'blacklist') {
    return 'Доступ к приложению заблокирован. Для уточнения причин обратитесь к администратору.';
  }
  return 'Сессия есть, но рабочий доступ пока недоступен.';
};

export const AccountStatePage = () => {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isContractor = session?.roleId === ROLE.CONTRACTOR;
  const isReview = session?.status === 'review';
  const isBlocked = session?.status === 'inactive' || session?.status === 'blacklist';

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true });
      return;
    }
    if (session.businessAccess) {
      navigate(getDefaultPathByRole(session.roleId), { replace: true });
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void getCurrentUserProfile()
      .then((data) => {
        if (cancelled) {
          return;
        }
        setDraft(buildDraft(data));
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить профиль.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, session]);

  const canEditCompany = useMemo(() => isContractor && isReview, [isContractor, isReview]);

  const saveProfile = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (canEditCompany && (!draft.companyName.trim() || !draft.inn.trim())) {
      setErrorMessage('Для отправки на проверку заполните компанию и ИНН.');
      return;
    }
    setIsSaving(true);
    try {
      const nextProfile = await updateMyProfile({
        full_name: draft.fullName.trim(),
        phone: draft.phone.trim(),
        mail: draft.mail.trim() || undefined
      });
      if (canEditCompany) {
        const nextWithCompany = await updateMyCompanyContacts({
          company_name: draft.companyName.trim(),
          inn: draft.inn.trim(),
          company_phone: draft.companyPhone.trim() || undefined,
          company_mail: draft.companyMail.trim() || undefined,
          address: draft.address.trim() || undefined,
          note: draft.note.trim() || undefined
        });
        setDraft(buildDraft(nextWithCompany));
      } else {
        setDraft(buildDraft(nextProfile));
      }
      setSuccessMessage('Данные сохранены. После проверки администратором доступ откроется автоматически.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить профиль.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Paper sx={{ p: 4, width: { xs: '100%', sm: 720 } }}>
        {isLoading ? (
          <Stack alignItems="center" spacing={2}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Загружаем локальный бизнес-профиль.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="h5" fontWeight={700}>
                Статус доступа: {session.status}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getStatusMessage(session.status)}
              </Typography>
            </Stack>

            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

            <Alert severity={isBlocked ? 'warning' : 'info'}>
              Аутентификация выполнена через {session.authProvider}, но бизнес-доступ определяется локальной моделью приложения.
            </Alert>

            {!isBlocked ? (
              <>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" fontWeight={600}>Личные данные</Typography>
                  <TextField
                    label="ФИО"
                    value={draft.fullName}
                    onChange={(event) => setDraft((prev) => ({ ...prev, fullName: event.target.value }))}
                  />
                  <TextField
                    label="Телефон"
                    value={draft.phone}
                    onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                  <TextField
                    label="E-mail"
                    value={draft.mail}
                    onChange={(event) => setDraft((prev) => ({ ...prev, mail: event.target.value }))}
                  />
                </Stack>

                {canEditCompany ? (
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" fontWeight={600}>Данные компании</Typography>
                    <TextField
                      label="Компания"
                      value={draft.companyName}
                      onChange={(event) => setDraft((prev) => ({ ...prev, companyName: event.target.value }))}
                    />
                    <TextField
                      label="ИНН"
                      value={draft.inn}
                      onChange={(event) => setDraft((prev) => ({ ...prev, inn: event.target.value }))}
                    />
                    <TextField
                      label="Телефон компании"
                      value={draft.companyPhone}
                      onChange={(event) => setDraft((prev) => ({ ...prev, companyPhone: event.target.value }))}
                    />
                    <TextField
                      label="E-mail компании"
                      value={draft.companyMail}
                      onChange={(event) => setDraft((prev) => ({ ...prev, companyMail: event.target.value }))}
                    />
                    <TextField
                      label="Адрес"
                      value={draft.address}
                      onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))}
                    />
                    <TextField
                      label="Примечание"
                      value={draft.note}
                      multiline
                      minRows={3}
                      onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                    />
                  </Stack>
                ) : null}

                <Button
                  variant="contained"
                  onClick={() => void saveProfile()}
                  disabled={isSaving}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none', boxShadow: 'none' }}
                >
                  {isSaving ? 'Сохраняем...' : 'Сохранить данные'}
                </Button>
              </>
            ) : null}

            <Stack direction="row" spacing={1.5}>
              <Button variant="outlined" onClick={logout} sx={{ textTransform: 'none' }}>
                Выйти
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>
    </Box>
  );
};
