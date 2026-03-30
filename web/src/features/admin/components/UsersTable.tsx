import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { UserListItem } from '@entities/user';
import { UnavailabilityManagementSection, UnavailabilityPeriodEditor, hasPeriodOverlapByDate } from '@entities/unavailability';
import { updateUserStatus } from '@shared/api/users/updateUserStatus';
import { updateUserManager } from '@shared/api/users/updateUserManager';
import { updateUserRole } from '@shared/api/users/updateUserRole';
import { getManagerCandidates } from '@shared/api/users/getManagerCandidates';
import { DataTable } from '@shared/components/DataTable';
import {
  getSubordinateProfile,
  setSubordinateUnavailabilityPeriod,
  type SubordinateProfile
} from '@shared/api/users/getSubordinateProfile';

const contractorColumns = [
  { key: 'login', label: 'Логин', minWidth: 170, fraction: 1.1 },
  { key: 'full_name', label: 'ФИО', minWidth: 190, fraction: 1.3 },
  { key: 'phone', label: 'Телефон', minWidth: 150, fraction: 1 },
  { key: 'mail', label: 'E-mail', minWidth: 190, fraction: 1.2 },
  { key: 'company_phone', label: 'Телефон компании', minWidth: 170, fraction: 1 },
  { key: 'company_mail', label: 'E-mail компании', minWidth: 190, fraction: 1.2 },
  { key: 'status', label: 'Статус', minWidth: 130, fraction: 0.9 }
];

const defaultColumns = [
  { key: 'id', label: 'ID', minWidth: 120, fraction: 1 },
  { key: 'password', label: 'Пароль', minWidth: 180, fraction: 1.4 },
  { key: 'id_role', label: 'ID роли', minWidth: 120, fraction: 1 },
  { key: 'role', label: 'Роль', minWidth: 180, fraction: 1.4 },
  { key: 'status', label: 'Статус профиля', minWidth: 170, fraction: 1.2 }
];

const statusSchema = z.object({
  user_status: z.enum(['review', 'active', 'inactive', 'blacklist'])
});

type StatusFormValues = z.infer<typeof statusSchema>;

const subordinateUnavailabilitySchema = z
  .object({
    status: z.enum(['sick', 'vacation', 'fired', 'maternity', 'business_trip', 'unavailable']),
    started_at: z.string().min(1, 'Выберите дату начала'),
    ended_at: z.string().min(1, 'Выберите дату окончания')
  })
  .refine((values) => new Date(values.ended_at).getTime() >= new Date(values.started_at).getTime(), {
    message: 'Дата окончания должна быть не раньше даты начала',
    path: ['ended_at']
  });

type SubordinateUnavailabilityFormValues = z.infer<typeof subordinateUnavailabilitySchema>;

type UsersTableProps = {
  users: UserListItem[];
  isLoading?: boolean;
  emptyMessage: string;
  getRoleLabel: (roleId: number) => string;
  isContractorsTab: boolean;
  canUpdateStatus: boolean;
  canUpdateRole: boolean;
  allowedRoleOptions: number[];
  onStatusUpdated: () => Promise<void>;
};

type UserRow = {
  id: string;
  password: string;
  id_role: number;
  role: string;
  status: StatusFormValues['user_status'];
};

const userStatusLabelByValue: Record<StatusFormValues['user_status'], string> = {
  review: 'На проверке',
  active: 'Активен',
  inactive: 'Неактивен',
  blacklist: 'В черном списке'
};

const tgStatusLabelByValue: Record<'review' | 'approved' | 'disapproved', string> = {
  review: 'На проверке',
  approved: 'Одобрен',
  disapproved: 'Не одобрен'
};

const userStatusValueByLabel: Record<string, StatusFormValues['user_status']> = {
  'на проверке': 'review',
  'активен': 'active',
  'неактивен': 'inactive',
  'в черном списке': 'blacklist',
  'в чёрном списке': 'blacklist'
};

const tgStatusValueByLabel: Record<string, 'review' | 'approved' | 'disapproved'> = {
  'на проверке': 'review',
  'одобрен': 'approved',
  'не одобрен': 'disapproved'
};

const normalizeUserStatus = (value: string | null | undefined): StatusFormValues['user_status'] => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized in userStatusLabelByValue) {
    return normalized as StatusFormValues['user_status'];
  }
  return userStatusValueByLabel[normalized] ?? 'review';
};

const normalizeAnyStatus = (value: string | null | undefined): string => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized in statusColorByValue) {
    return normalized;
  }
  if (normalized in userStatusValueByLabel) {
    return userStatusValueByLabel[normalized];
  }
  if (normalized in tgStatusValueByLabel) {
    return tgStatusValueByLabel[normalized];
  }
  return normalized;
};

const toStatusLabel = (value: string | null | undefined): string => {
  const normalized = normalizeAnyStatus(value);
  if (normalized in userStatusLabelByValue) {
    return userStatusLabelByValue[normalized as StatusFormValues['user_status']];
  }
  if (normalized in tgStatusLabelByValue) {
    return tgStatusLabelByValue[normalized as 'review' | 'approved' | 'disapproved'];
  }
  return value ?? '—';
};

const statusColorByValue: Record<string, { bg: string; text: string; border: string }> = {
  review: { bg: '#fff8e1', text: '#8a6d1f', border: '#f2dd9b' },
  active: { bg: '#e8f7ee', text: '#1f6b43', border: '#b7e2c8' },
  inactive: { bg: '#f3f4f8', text: '#4d5563', border: '#d9dde8' },
  blacklist: { bg: '#ffecec', text: '#9a1f1f', border: '#f3bcbc' },
  approved: { bg: '#e8f7ee', text: '#1f6b43', border: '#b7e2c8' },
  disapproved: { bg: '#ffecec', text: '#9a1f1f', border: '#f3bcbc' }
};

const StatusPill = ({ value }: { value: string | null | undefined }) => {
  const normalized = normalizeAnyStatus(value);
  const palette = statusColorByValue[normalized] ?? {
    bg: '#edf3ff',
    text: '#1f2a44',
    border: '#d3dbe7'
  };

  return (
    <Box
      component="span"
      sx={{
        px: 1.2,
        py: 0.3,
        borderRadius: 99,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        color: palette.text,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.3,
        width: 'fit-content',
        display: 'inline-flex'
      }}
    >
      {toStatusLabel(value)}
    </Box>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string | number | null }) => (
  <Stack spacing={0.2} sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </Typography>
    <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary', overflowWrap: 'anywhere' }}>
      {value ?? '—'}
    </Typography>
  </Stack>
);

const SourceSection = ({
  title,
  source,
  children
}: {
  title: string;
  source: string;
  children: ReactNode;
}) => (
  <Box
    sx={{
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      p: { xs: 1.4, sm: 1.8 },
      backgroundColor: 'background.paper'
    }}
  >
    <Stack spacing={1.2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" rowGap={0.6}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {title}
        </Typography>
        <Box
          component="span"
          sx={{
            px: 1,
            py: 0.2,
            borderRadius: 99,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.default',
            color: 'text.secondary',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.03em'
          }}
        >
          {source}
        </Box>
      </Stack>
      {children}
    </Stack>
  </Box>
);

const mapUserStatusToTgStatus = (status: StatusFormValues['user_status']) => {
  if (status === 'review') return 'review';
  if (status === 'active') return 'approved';
  return 'disapproved';
};

const resolveTgStatusForUpdate = (
  user: UserListItem,
  status: StatusFormValues['user_status']
): 'review' | 'approved' | 'disapproved' | undefined => {
  if (user.tg_user_id === null) {
    return undefined;
  }
  return mapUserStatusToTgStatus(status);
};

const inlineStatusOptions: Array<StatusFormValues['user_status']> = ['review', 'active', 'inactive', 'blacklist'];


const statusMemoText = `Связь статусов users и tg_users:

1) users: review  → tg_users: review
   Пользователь на проверке, доступ не выдан.

2) users: active  → tg_users: approved
   Пользователь активен, доступ разрешён.

3) users: inactive → tg_users: disapproved
   Пользователь деактивирован, доступ запрещён.

4) users: blacklist → tg_users: disapproved
   Пользователь в чёрном списке, доступ запрещён.`;

const dialogPaperSx = (theme: Theme) => ({
  borderRadius: 2,
  px: { xs: 2.5, sm: 3.5 },
  py: { xs: 3, sm: 3.5 },
  backgroundColor: theme.palette.background.default,
  maxHeight: 'min(760px, calc(100vh - 32px))',
  overflow: 'hidden',
  boxShadow: `0 24px 80px ${alpha(theme.palette.common.black, 0.18)}`
});

const dialogContentSx = {
  p: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': {
    display: 'none'
  }
};

export const UsersTable = ({
  users,
  isLoading,
  emptyMessage,
  getRoleLabel,
  isContractorsTab,
  canUpdateStatus,
  canUpdateRole,
  allowedRoleOptions,
  onStatusUpdated
}: UsersTableProps) => {
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [inlineStatusError, setInlineStatusError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [inlineRoleError, setInlineRoleError] = useState<string | null>(null);
  const [subordinateProfile, setSubordinateProfile] = useState<SubordinateProfile | null>(null);
  const [subordinateError, setSubordinateError] = useState<string | null>(null);
  const [managerOptions, setManagerOptions] = useState<UserListItem[]>([]);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [managerUserId, setManagerUserId] = useState('');
  const [isUpdatingManager, setIsUpdatingManager] = useState(false);
  const [openSubordinateUnavailability, setOpenSubordinateUnavailability] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<StatusFormValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      user_status: 'review'
    }
  });

  useEffect(() => {
    if (selectedUser) {
      reset({
        user_status: normalizeUserStatus(selectedUser.status)
      });
    }
  }, [reset, selectedUser]);

  const {
    register: registerSubordinateUnavailability,
    handleSubmit: handleSubordinateUnavailabilitySubmit,
    watch: watchSubordinateUnavailability,
    setValue: setSubordinateUnavailabilityValue,
    formState: { errors: subordinateUnavailabilityErrors, isSubmitting: isSubmittingSubordinateUnavailability },
    reset: resetSubordinateUnavailability
  } = useForm<SubordinateUnavailabilityFormValues>({
    resolver: zodResolver(subordinateUnavailabilitySchema),
    defaultValues: { status: 'unavailable', started_at: '', ended_at: '' }
  });

  useEffect(() => {
    if (!subordinateProfile) {
      return;
    }
    resetSubordinateUnavailability({
      status: 'unavailable',
      started_at: '',
      ended_at: ''
    });
  }, [subordinateProfile, resetSubordinateUnavailability]);

  useEffect(() => {
    setManagerUserId(selectedUser?.id_parent ?? '');
  }, [selectedUser?.id_parent]);

  useEffect(() => {
    if (!selectedUser?.actions.update_manager) {
      setManagerOptions([]);
      return;
    }

    let isCancelled = false;
    setManagerError(null);
    void getManagerCandidates(selectedUser.role_id)
      .then((result) => {
        if (!isCancelled) {
          setManagerOptions(result.items);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setManagerError(error instanceof Error ? error.message : 'Не удалось загрузить список руководителей');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedUser?.actions.update_manager, selectedUser?.role_id, selectedUser?.user_id]);

  const rows: UserRow[] = useMemo(
    () =>
      users.map((user) => ({
        id: user.user_id,
        password: '—',
        id_role: user.role_id,
        role: getRoleLabel(user.role_id),
        status: normalizeUserStatus(user.status)
      })),
    [getRoleLabel, users]
  );

  const canEditUserStatus = (userId: string) => {
    const user = users.find((item) => item.user_id === userId);
    if (!canUpdateStatus || !user || !user.actions.update_status) {
      return false;
    }
    return true;
  };

  const handleStatusSubmit = async (values: StatusFormValues) => {
    if (!selectedUser) return;
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await updateUserStatus(selectedUser.user_id, {
        user_status: values.user_status,
        tg_status: resolveTgStatusForUpdate(selectedUser, values.user_status)
      });
      setSubmitSuccess('Статус успешно обновлён.');
      await onStatusUpdated();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Не удалось обновить статус');
    }
  };

  const handleInlineStatusChange = async (userId: string, nextStatus: StatusFormValues['user_status']) => {
    setInlineStatusError(null);
    setUpdatingUserId(userId);

    try {
      const user = users.find((item) => item.user_id === userId);
      await updateUserStatus(userId, {
        user_status: nextStatus,
        tg_status: user ? resolveTgStatusForUpdate(user, nextStatus) : undefined
      });
      await onStatusUpdated();
    } catch (error) {
      setInlineStatusError(error instanceof Error ? error.message : 'Не удалось обновить статус');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleInlineRoleChange = async (userId: string, nextRoleId: number) => {
    setInlineRoleError(null);
    setUpdatingUserId(userId);

    try {
      await updateUserRole(userId, { role_id: nextRoleId });
      await onStatusUpdated();
    } catch (error) {
      setInlineRoleError(error instanceof Error ? error.message : 'Не удалось обновить роль');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleManagerUpdate = async () => {
    if (!selectedUser || !managerUserId || managerUserId === selectedUser.id_parent) {
      return;
    }

    setManagerError(null);
    setIsUpdatingManager(true);
    try {
      await updateUserManager(selectedUser.user_id, { manager_user_id: managerUserId });
      await onStatusUpdated();
      setSelectedUser(null);
      setSubordinateProfile(null);
    } catch (error) {
      setManagerError(error instanceof Error ? error.message : 'Не удалось обновить руководителя');
    } finally {
      setIsUpdatingManager(false);
    }
  };

  if (!isContractorsTab) {
    return (
      <>
        <Stack spacing={1.2}>
          {inlineStatusError ? <Alert severity="error">{inlineStatusError}</Alert> : null}
          {inlineRoleError ? <Alert severity="error">{inlineRoleError}</Alert> : null}
          <DataTable
            columns={defaultColumns}
            rows={rows}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
            storageKey="users-table"
            onRowClick={(row) => {
              const clickedUser = users.find((item) => item.user_id === row.id);
              if (clickedUser) {
                setSelectedUser(clickedUser);
                setSubordinateProfile(null);
                setSubordinateError(null);
                setManagerOptions([]);
                setManagerError(null);
                setManagerUserId(clickedUser.id_parent ?? '');
                setOpenSubordinateUnavailability(false);
                void getSubordinateProfile(clickedUser.user_id)
                  .then((profile) => setSubordinateProfile(profile))
                  .catch((error) => {
                    setSubordinateError(error instanceof Error ? error.message : 'Не удалось загрузить нерабочие статусы');
                  });
              }
            }}
            renderRow={(row) => [
              <Typography variant="body2">{row.id}</Typography>,
              <Typography variant="body2">{row.password}</Typography>,
              <Typography variant="body2">{row.id_role}</Typography>,
              allowedRoleOptions.includes(row.id_role) ? (
                <TextField
                  select
                  size="small"
                  value={row.id_role}
                  disabled={!canUpdateRole || updatingUserId === row.id || !users.find((item) => item.user_id === row.id)?.actions.update_role}
                  onChange={(event) => {
                    event.stopPropagation();
                    const nextRoleId = Number(event.target.value);
                    if (nextRoleId === row.id_role) {
                      return;
                    }
                    void handleInlineRoleChange(row.id, nextRoleId);
                  }}
                  sx={{ minWidth: 140 }}
                >
                  {allowedRoleOptions.map((roleId) => (
                    <MenuItem key={roleId} value={roleId}>
                      {getRoleLabel(roleId)}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <Typography variant="body2">{row.role}</Typography>
              ),
              <TextField
                select
                size="small"
                value={row.status}
                disabled={!canEditUserStatus(row.id) || updatingUserId === row.id}
                onChange={(event) => {
                  event.stopPropagation();
                  const nextStatus = event.target.value as StatusFormValues['user_status'];
                  if (nextStatus === row.status) {
                    return;
                  }
                  void handleInlineStatusChange(row.id, nextStatus);
                }}
                sx={{ minWidth: 140 }}
              >
                {inlineStatusOptions.map((status) => (
                  <MenuItem key={status} value={status}>
                    {userStatusLabelByValue[status]}
                  </MenuItem>
                ))}
              </TextField>
            ]}
          />
        </Stack>

        <Dialog
          open={Boolean(selectedUser)}
          onClose={() => {
            setSelectedUser(null);
            setOpenSubordinateUnavailability(false);
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: dialogPaperSx
          }}
        >
          <DialogContent sx={dialogContentSx}>
            {selectedUser ? (
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={600} lineHeight={1}>
                  Карточка пользователя
                </Typography>

                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: { xs: 1.4, sm: 1.6 },
                    backgroundColor: 'background.paper'
                  }}
                >
                  <Stack spacing={1.2}>
                    <SourceSection title="Пользователь" source="users">
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          gap: 1.5
                        }}
                      >
                        <InfoRow label="Логин" value={selectedUser.user_id} />
                        <Stack spacing={0.2} sx={{ alignItems: 'flex-start' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Статус users
                          </Typography>
                          <StatusPill value={selectedUser.status} />
                        </Stack>
                      </Box>
                    </SourceSection>

                    <SourceSection title="Профиль пользователя" source="profiles">
                      <Stack spacing={1.2}>
                        <InfoRow label="ФИО" value={selectedUser.full_name} />
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                            gap: 1.2
                          }}
                        >
                          <InfoRow label="Телефон" value={selectedUser.phone} />
                          <InfoRow label="E-mail" value={selectedUser.mail} />
                        </Box>
                      </Stack>
                    </SourceSection>
                  </Stack>
                </Box>

                {subordinateProfile ? (
                  <Stack spacing={1.2}>
                    {subordinateError ? <Alert severity="warning">{subordinateError}</Alert> : null}
                    <UnavailabilityManagementSection
                      currentPeriod={subordinateProfile.unavailablePeriod}
                      periods={subordinateProfile.unavailablePeriods}
                      canEdit={subordinateProfile.actions.manage_subordinate_unavailability}
                      isDialogOpen={openSubordinateUnavailability}
                      onOpenDialog={() => setOpenSubordinateUnavailability(true)}
                      onCloseDialog={() => setOpenSubordinateUnavailability(false)}
                      onSubmit={handleSubordinateUnavailabilitySubmit(async (values) => {
                        if (!selectedUser) {
                          return;
                        }

                        const newPeriodStart = new Date(values.started_at).toISOString();
                        const newPeriodEnd = new Date(values.ended_at).toISOString();

                        const overlapPeriod = subordinateProfile.unavailablePeriods.find((period) =>
                          hasPeriodOverlapByDate(newPeriodStart, newPeriodEnd, period.startedAt, period.endedAt)
                        );
                        if (overlapPeriod) {
                          const startedAt = new Date(overlapPeriod.startedAt).toLocaleDateString('ru-RU');
                          const endedAt = new Date(overlapPeriod.endedAt).toLocaleDateString('ru-RU');
                          setSubordinateError(`Период пересекается с уже существующим периодом (${startedAt} — ${endedAt})`);
                          return;
                        }

                        setSubordinateError(null);
                        const nextProfile = await setSubordinateUnavailabilityPeriod(selectedUser.user_id, {
                          status: values.status,
                          started_at: newPeriodStart,
                          ended_at: newPeriodEnd
                        });
                        setSubordinateProfile(nextProfile);
                        setOpenSubordinateUnavailability(false);
                      })}
                      isSubmitting={isSubmittingSubordinateUnavailability}
                      dialogTitle="Установить нерабочий период"
                      triggerLabel="Установить нерабочий период"
                      submitLabel="Сохранить период"
                      dialogNotice={subordinateError ? <Alert severity="warning">{subordinateError}</Alert> : null}
                      editor={
                        <UnavailabilityPeriodEditor
                          statusField={registerSubordinateUnavailability('status')}
                          startedAtField={registerSubordinateUnavailability('started_at')}
                          endedAtField={registerSubordinateUnavailability('ended_at')}
                          startedAtValue={watchSubordinateUnavailability('started_at') ?? ''}
                          endedAtValue={watchSubordinateUnavailability('ended_at') ?? ''}
                          onStartedAtChange={(value: string) =>
                            setSubordinateUnavailabilityValue('started_at', value, { shouldValidate: true, shouldDirty: true })
                          }
                          onEndedAtChange={(value: string) =>
                            setSubordinateUnavailabilityValue('ended_at', value, { shouldValidate: true, shouldDirty: true })
                          }
                          statusError={subordinateUnavailabilityErrors.status?.message}
                          startedAtError={subordinateUnavailabilityErrors.started_at?.message}
                          endedAtError={subordinateUnavailabilityErrors.ended_at?.message}
                        />
                      }
                    />
                  </Stack>
                ) : subordinateError ? (
                  <Alert severity="info">{subordinateError}</Alert>
                ) : null}

                {selectedUser.actions.update_manager ? (
                  <Stack
                    spacing={1.2}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: { xs: 1.4, sm: 1.8 },
                      backgroundColor: 'background.paper'
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Смена руководителя
                    </Typography>
                    {managerError ? <Alert severity="warning">{managerError}</Alert> : null}
                    <TextField
                      select
                      size="small"
                      label="Новый руководитель"
                      value={managerUserId}
                      onChange={(event) => setManagerUserId(event.target.value)}
                      disabled={isUpdatingManager || managerOptions.filter((manager) => manager.user_id !== selectedUser.user_id).length === 0}
                      helperText={
                        managerOptions.filter((manager) => manager.user_id !== selectedUser.user_id).length
                          ? ''
                          : 'Нет доступных руководителей'
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                          backgroundColor: 'background.paper'
                        }
                      }}
                    >
                      {managerOptions
                        .filter((manager) => manager.user_id !== selectedUser.user_id)
                        .map((manager) => (
                        <MenuItem key={manager.user_id} value={manager.user_id}>
                          {manager.full_name ? `${manager.full_name} (${manager.user_id})` : manager.user_id}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Stack direction="row" justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        onClick={() => void handleManagerUpdate()}
                        disabled={
                          !managerUserId
                          || managerUserId === selectedUser.id_parent
                          || isUpdatingManager
                          || managerOptions.filter((manager) => manager.user_id !== selectedUser.user_id).length === 0
                        }
                        sx={{ borderRadius: 1, textTransform: 'none' }}
                      >
                        {isUpdatingManager ? 'Сохранение...' : 'Сохранить руководителя'}
                      </Button>
                    </Stack>
                  </Stack>
                ) : null}


                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setSelectedUser(null);
                      setOpenSubordinateUnavailability(false);
                    }}
                    sx={{ borderRadius: 1, textTransform: 'none' }}
                  >
                    Закрыть
                  </Button>
                </Stack>
              </Stack>
            ) : null}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <DataTable
        columns={contractorColumns}
        rows={users}
        rowKey={(row) => row.user_id}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        storageKey="contractors-table"
        onRowClick={(row) => {
          setSelectedUser(row);
          setSubmitError(null);
          setSubmitSuccess(null);
        }}
        renderRow={(row) => [
          <Typography variant="body2">{row.user_id}</Typography>,
          <Typography variant="body2">{row.full_name ?? '—'}</Typography>,
          <Typography variant="body2">{row.phone ?? '—'}</Typography>,
          <Typography variant="body2">{row.mail ?? '—'}</Typography>,
          <Typography variant="body2">{row.company_phone ?? '—'}</Typography>,
          <Typography variant="body2">{row.company_mail ?? '—'}</Typography>,
          <StatusPill value={row.status} />
        ]}
      />

      <Dialog
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: dialogPaperSx
        }}
      >
        <DialogContent sx={dialogContentSx}>
          {selectedUser ? (
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={600} lineHeight={1}>
                Карточка контрагента
              </Typography>

              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: { xs: 1.4, sm: 1.6 },
                  backgroundColor: 'background.paper'
                }}
              >
                <Stack spacing={1.2}>
                  <SourceSection title="Пользователь" source="users">
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 1.5
                      }}
                    >
                      <InfoRow label="Логин" value={selectedUser.user_id} />
                      <Stack spacing={0.2} sx={{ alignItems: 'flex-start' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Статус users
                        </Typography>
                        <StatusPill value={selectedUser.status} />
                      </Stack>
                    </Box>
                  </SourceSection>

                  <SourceSection title="Профиль пользователя" source="profiles">
                    <Stack spacing={1.2}>
                      <InfoRow label="ФИО" value={selectedUser.full_name} />
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                          gap: 1.2
                        }}
                      >
                        <InfoRow label="Телефон" value={selectedUser.phone} />
                        <InfoRow label="E-mail" value={selectedUser.mail} />
                      </Box>
                    </Stack>
                  </SourceSection>

                  <SourceSection title="Контакты компании" source="company_contacts">
                    <Stack spacing={1.2}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                          gap: 1.2
                        }}
                      >
                        <InfoRow label="ИНН" value={selectedUser.inn} />
                        <InfoRow label="Компания" value={selectedUser.company_name} />
                      </Box>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                          gap: 1.2
                        }}
                      >
                        <InfoRow label="Телефон компании" value={selectedUser.company_phone} />
                        <InfoRow label="E-mail компании" value={selectedUser.company_mail} />
                        <InfoRow label="Адрес" value={selectedUser.address} />
                      </Box>
                      <InfoRow label="Примечание" value={selectedUser.note} />
                    </Stack>
                  </SourceSection>

                  <SourceSection title="Telegram данные" source="tg_users">
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 1.5
                      }}
                    >
                      <InfoRow label="Telegram ID" value={selectedUser.tg_user_id} />
                      <Stack spacing={0.2} sx={{ alignItems: 'flex-start' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Telegram статус
                        </Typography>
                        <StatusPill value={selectedUser.tg_status} />
                      </Stack>
                    </Box>
                  </SourceSection>
                </Stack>
              </Box>

              {canUpdateStatus ? (
                <Stack
                  spacing={1.2}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: { xs: 1.4, sm: 1.8 },
                    backgroundColor: 'background.paper'
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Изменение статуса
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TextField
                      label="Изменить статус"
                      select
                      fullWidth
                      defaultValue={normalizeUserStatus(selectedUser.status)}
                      {...register('user_status')}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                          backgroundColor: 'background.paper'
                        }
                      }}
                    >
                      <MenuItem value="review">На проверке</MenuItem>
                      <MenuItem value="active">Активен</MenuItem>
                      <MenuItem value="inactive">Неактивен</MenuItem>
                      <MenuItem value="blacklist">В черном списке</MenuItem>
                    </TextField>
                    <Tooltip
                      arrow
                      placement="top-start"
                      title={
                        <Typography
                          variant="body2"
                          sx={{
                            m: 0,
                            whiteSpace: 'pre-line',
                            lineHeight: 1.45
                          }}
                        >
                          {statusMemoText}
                        </Typography>
                      }
                      slotProps={{
                        tooltip: {
                          sx: {
                            maxWidth: 380,
                            p: 1.4,
                            borderRadius: 2
                          }
                        }
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: '1px solid',
                          borderColor: 'primary.main',
                          color: 'primary.main',
                          fontSize: 14,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        ?
                      </Box>
                    </Tooltip>
                  </Stack>

                  {submitError ? <Alert severity="error">{submitError}</Alert> : null}
                  {submitSuccess ? <Alert severity="success">{submitSuccess}</Alert> : null}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="flex-end">
                    <Button variant="outlined" onClick={() => setSelectedUser(null)} sx={{ borderRadius: 1, textTransform: 'none' }}>
                      Закрыть
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSubmit(handleStatusSubmit)}
                      disabled={isSubmitting}
                      sx={{ borderRadius: 1, textTransform: 'none', minWidth: 180, boxShadow: 'none' }}
                    >
                      {isSubmitting ? 'Сохранение...' : 'Сохранить статус'}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Alert severity="info">Изменение статуса недоступно: backend не вернул доступное действие.</Alert>
              )}
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
