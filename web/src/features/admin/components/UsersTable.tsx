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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { UserListItem } from '@shared/api/getUsers';
import { updateUserStatus } from '@shared/api/updateUserStatus';
import { DataTable } from '@shared/components/DataTable';

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
  { key: 'id', label: 'id', minWidth: 120, fraction: 1 },
  { key: 'password', label: 'password', minWidth: 180, fraction: 1.4 },
  { key: 'id_role', label: 'id_role', minWidth: 120, fraction: 1 },
  { key: 'role', label: 'role', minWidth: 180, fraction: 1.4 },
  { key: 'status', label: 'Статус профиля', minWidth: 170, fraction: 1.2 }
];

const statusSchema = z.object({
  user_status: z.enum(['review', 'active', 'inactive', 'blacklist'])
});

type StatusFormValues = z.infer<typeof statusSchema>;

type UsersTableProps = {
  users: UserListItem[];
  isLoading?: boolean;
  emptyMessage: string;
  getRoleLabel: (roleId: number) => string;
  isContractorsTab: boolean;
  canUpdateStatus: boolean;
  onStatusUpdated: () => Promise<void>;
};

type UserRow = {
  id: string;
  password: string;
  id_role: number;
  role: string;
  status: StatusFormValues['user_status'];
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
  const normalized = (value ?? '').toLowerCase();
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
        textTransform: 'lowercase',
        width: 'fit-content',
        display: 'inline-flex'
      }}
    >
      {value ?? '—'}
    </Box>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string | number | null }) => (
  <Stack spacing={0.2} sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </Typography>
    <Typography variant="body1" sx={{ fontWeight: 500, color: '#1f2a44', overflowWrap: 'anywhere' }}>
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
      border: '1px solid #d6dfef',
      borderRadius: 2,
      p: { xs: 1.4, sm: 1.8 },
      backgroundColor: '#ffffff'
    }}
  >
    <Stack spacing={1.2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" rowGap={0.6}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1f2a44' }}>
          {title}
        </Typography>
        <Box
          component="span"
          sx={{
            px: 1,
            py: 0.2,
            borderRadius: 99,
            border: '1px solid #d9e3f4',
            backgroundColor: '#eef4ff',
            color: '#3d5a86',
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

export const UsersTable = ({
  users,
  isLoading,
  emptyMessage,
  getRoleLabel,
  isContractorsTab,
  canUpdateStatus,
  onStatusUpdated
}: UsersTableProps) => {
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [inlineStatusError, setInlineStatusError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

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
        user_status: (selectedUser.status as StatusFormValues['user_status']) ?? 'review'
      });
    }
  }, [reset, selectedUser]);

  const rows: UserRow[] = useMemo(
    () =>
      users.map((user) => ({
        id: user.user_id,
        password: '—',
        id_role: user.role_id,
        role: getRoleLabel(user.role_id),
        status: (user.status as StatusFormValues['user_status']) ?? 'review'
      })),
    [getRoleLabel, users]
  );

  const handleStatusSubmit = async (values: StatusFormValues) => {
    if (!selectedUser) return;
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await updateUserStatus(selectedUser.user_id, {
        user_status: values.user_status,
        tg_status: mapUserStatusToTgStatus(values.user_status)
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
      await updateUserStatus(userId, {
        user_status: nextStatus,
        tg_status: mapUserStatusToTgStatus(nextStatus)
      });
      await onStatusUpdated();
    } catch (error) {
      setInlineStatusError(error instanceof Error ? error.message : 'Не удалось обновить статус');
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!isContractorsTab) {
    return (
      <Stack spacing={1.2}>
        {inlineStatusError ? <Alert severity="error">{inlineStatusError}</Alert> : null}
        <DataTable
          columns={defaultColumns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          storageKey="users-table"
          renderRow={(row) => [
            <Typography variant="body2">{row.id}</Typography>,
            <Typography variant="body2">{row.password}</Typography>,
            <Typography variant="body2">{row.id_role}</Typography>,
            <Typography variant="body2">{row.role}</Typography>,
            <TextField
              select
              size="small"
              value={row.status}
              disabled={!canUpdateStatus || updatingUserId === row.id}
              onChange={(event) => {
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
                  {status}
                </MenuItem>
              ))}
            </TextField>
          ]}
        />
      </Stack>
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
          sx: {
            borderRadius: 2,
            p: { xs: 2, md: 2.5 },
            maxHeight: '92vh'
          }
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          {selectedUser ? (
            <Stack spacing={1.8}>
              <Typography variant="h5" fontWeight={700} textAlign="center">
                Карточка контрагента
              </Typography>

              <Box
                sx={{
                  border: '1px solid #d3dbe7',
                  borderRadius: 1,
                  p: { xs: 1.4, sm: 1.6 },
                  backgroundColor: '#f8fbff'
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
                    border: '2px solid #bcd0f5',
                    borderRadius: 2,
                    p: { xs: 1.4, sm: 1.8 },
                    background: 'linear-gradient(180deg, #f4f8ff 0%, #ffffff 100%)',
                    boxShadow: '0 8px 24px rgba(39, 87, 171, 0.12)'
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1f2a44' }}>
                    Изменение статуса
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TextField
                      label="Изменить статус"
                      select
                      fullWidth
                      defaultValue={selectedUser.status ?? 'review'}
                      {...register('user_status')}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2
                        }
                      }}
                    >
                      <MenuItem value="review">review</MenuItem>
                      <MenuItem value="active">active</MenuItem>
                      <MenuItem value="inactive">inactive</MenuItem>
                      <MenuItem value="blacklist">blacklist</MenuItem>
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
                          border: '1px solid #2f6fd6',
                          color: '#2f6fd6',
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
                    <Button variant="outlined" onClick={() => setSelectedUser(null)} sx={{ borderRadius: 999, textTransform: 'none' }}>
                      Закрыть
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSubmit(handleStatusSubmit)}
                      disabled={isSubmitting}
                      sx={{ borderRadius: 999, textTransform: 'none', minWidth: 180, boxShadow: 'none' }}
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