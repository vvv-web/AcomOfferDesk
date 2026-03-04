import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { UsersTable } from '@features/admin/components/UsersTable';
import { useAuth } from '@app/providers/AuthProvider';
import { getEconomists } from '@shared/api/getEconomists';
import { getUsers, type UserListItem } from '@shared/api/getUsers';
import { registerUser } from '@shared/api/registerUser';
import { hasAvailableAction } from '@shared/auth/availableActions';

const schema = z
  .object({
    login: z.string().min(3, 'Минимум 3 символа'),
    password: z.string().min(6, 'Минимум 6 символов'),
    confirmPassword: z.string().min(6, 'Минимум 6 символов'),
    role_id: z.number({ required_error: 'Выберите роль' })
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword']
    })
;

type FormValues = z.infer<typeof schema>;
type UserTab = 'contractors' | 'economists' | 'admins';

const roleByTab: Record<UserTab, number> = {
  contractors: 5,
  economists: 4,
  admins: 2
};

const tabOptions: Array<{ value: UserTab; label: string }> = [
  { value: 'contractors', label: 'Контрагенты' },
  { value: 'economists', label: 'Экономисты' },
  { value: 'admins', label: 'Администраторы' }
];

const resolveUserTabFromParam = (value: string | null): UserTab => {
  if (value === 'economists' || value === 'admins') {
    return value;
  }
  return 'contractors';
};

const roleLabelsById: Record<number, string> = {
  1: 'Суперадмин',
  2: 'Админ',
  3: 'Ведущий экономист',
  4: 'Экономист',
  5: 'Контрагент'
};

const addUserButtonSx  = {
  borderRadius: 999,
  textTransform: 'none',
  px: 3,
  minWidth: 220,
  whiteSpace: 'nowrap'
};

const normalizeActionHref = (href: string) => {
  const normalizedHref = href.trim();
  if (!normalizedHref) return '';

  const url = normalizedHref.startsWith('http')
    ? new URL(normalizedHref)
    : new URL(normalizedHref, 'http://local');

  return url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '');
};

const canPatchUserStatus = (href: string, method: string) => {
  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod !== 'PATCH') return false;

  const pathname = normalizeActionHref(href);
  const statusPattern = /^\/api\/v1\/users\/(\{user_id\}|[^/]+)\/status$/;

  return statusPattern.test(pathname);
};

const canPatchUserRole = (href: string, method: string) => {
  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod !== 'PATCH') return false;

  const pathname = normalizeActionHref(href);
  const rolePattern = /^\/api\/v1\/users\/(\{user_id\}|[^/]+)\/role$/;

  return rolePattern.test(pathname);
};

export const AdminPage = () => {
  const { session } = useAuth();
  const isLeadEconomist = session?.roleId === 3;
  const isAdmin = session?.roleId === 2;
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<UserTab>(() =>
    isLeadEconomist ? 'economists' : resolveUserTabFromParam(searchParams.get('users_tab'))
  );
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [canUpdateStatus, setCanUpdateStatus] = useState(false);
  const [canUpdateRole, setCanUpdateRole] = useState(false);

  const roleOptions = useMemo(() => {
    if (isLeadEconomist) {
      return [{ id: 4, label: roleLabelsById[4] }];
    }

    if (session?.roleId === 1) {
      return [
        { id: 2, label: roleLabelsById[2] },
        { id: 3, label: roleLabelsById[3] },
        { id: 4, label: roleLabelsById[4] }
      ];
    }

    return [
      { id: 2, label: roleLabelsById[2] },
      { id: 4, label: roleLabelsById[4] }
    ];
  }, [isLeadEconomist, session?.roleId]);

  const userTabs = useMemo(
    () => (isLeadEconomist ? tabOptions.filter((tab) => tab.value === 'economists') : tabOptions),
    [isLeadEconomist]
  );

  const getRoleLabel = useCallback((roleId: number) => roleLabelsById[roleId] ?? `Роль ${roleId}`, []);

  const canCreateUser = hasAvailableAction(session, '/api/v1/users/register', 'POST');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      login: '',
      password: '',
      confirmPassword: '',
      role_id: roleOptions[0]?.id ?? 2,
    }
  });


  useEffect(() => {
    if (isLeadEconomist) {
      setActiveTab('economists');
    }
  }, [isLeadEconomist]);

  useEffect(() => {
    if (isLeadEconomist) {
      return;
    }
    const nextTab = resolveUserTabFromParam(searchParams.get('users_tab'));
    setActiveTab(nextTab);
  }, [isLeadEconomist, searchParams]);


  useEffect(() => {
    if (!canCreateUser) {
      return;
    }

    if (searchParams.get('create') === '1') {
      setIsDialogOpen(true);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('create');
          return next;
        },
        { replace: true }
      );
    }
  }, [canCreateUser, searchParams, setSearchParams]);


  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      const response =
        activeTab === 'economists'
          ? await getEconomists()
          : await getUsers(roleByTab[activeTab]);
      setUsers(response.items);
      setCanUpdateStatus(
        response.availableActions.some((action) => canPatchUserStatus(action.href, action.method))
      );
      setCanUpdateRole(
        response.availableActions.some((action) => canPatchUserRole(action.href, action.method))
      );
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Не удалось загрузить список пользователей');
      setCanUpdateStatus(false);
      setCanUpdateRole(false);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const resetForm = useCallback(() => {
    reset({
      login: '',
      password: '',
      confirmPassword: '',
      role_id: roleOptions[0]?.id ?? 2,
    });
  }, [reset, roleOptions]);

  const handleClose = () => {
    setIsDialogOpen(false);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      },
      { replace: true }
    );
    setErrorMessage(null);
    setSuccessMessage(null);
    resetForm();
  };

  const onSubmit = async (values: FormValues) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await registerUser({
        login: values.login,
        password: values.password,
        role_id: values.role_id,
      });
      setSuccessMessage(`Пользователь ${response.data.user_id} создан.`);
      resetForm();
      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось создать пользователя');
    }
  };


  return (
    <Stack spacing={2}>
      {!isLeadEconomist && !isAdmin ? (
        <Stack
          direction="row"
          gap={1.5}
          alignItems="center"
          flexWrap="nowrap"
          sx={{ width: '100%', overflowX: 'auto', pb: 0.5 }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, value: UserTab) => {
              setActiveTab(value);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('users_tab', value);
                return next;
              }, { replace: true });
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 44, flexShrink: 0 }}
          >
            {userTabs.map((tab) => (
              <Tab key={tab.value} value={tab.value} label={tab.label} sx={{ textTransform: 'none', minHeight: 44 }} />
            ))}
          </Tabs>
          {canCreateUser ? (
            <Button variant="outlined" sx={{ ...addUserButtonSx, flexShrink: 0 }} onClick={() => setIsDialogOpen(true)}>
              Добавить пользователя
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Нет доступных действий для создания пользователей.
            </Typography>
          )}
        </Stack>
      ) : null}

      {usersError ? <Alert severity="error">{usersError}</Alert> : null}

      <UsersTable
        users={users}
        isLoading={isLoadingUsers}
        emptyMessage="Список пользователей пока пуст."
        getRoleLabel={getRoleLabel}
        isContractorsTab={activeTab === 'contractors'}
        canUpdateStatus={canUpdateStatus}
        canUpdateRole={canUpdateRole}
        allowedRoleOptions={[2, 4]}
        onStatusUpdated={loadUsers}
      />

      <Dialog
        open={isDialogOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: { xs: 2.5, md: 3 }
          }
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <Stack spacing={2.2}>
            <Typography variant="h5" textAlign="center" fontWeight={700}>
              Создание нового пользователя
            </Typography>
            <TextField
              label="Роль пользователя"
              select
              error={Boolean(errors.role_id)}
              helperText={errors.role_id?.message}
              defaultValue={roleOptions[0]?.id ?? 2}
              {...register('role_id', { valueAsNumber: true })}
            >
              {roleOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Логин" error={Boolean(errors.login)} helperText={errors.login?.message} {...register('login')} />
            <TextField label="Пароль" type="password" error={Boolean(errors.password)} helperText={errors.password?.message} {...register('password')} />
            <TextField label="Повторите пароль" type="password" error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} {...register('confirmPassword')} />
      
            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="center">
              
              <Button
                variant="contained"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                sx={{ borderRadius: 999, textTransform: 'none', minWidth: 220, boxShadow: 'none' }}
              >
                {isSubmitting ? 'Сохранение...' : 'Создать пользователя'}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
};