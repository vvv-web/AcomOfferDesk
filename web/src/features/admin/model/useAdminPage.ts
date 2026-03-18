import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@app/providers/AuthProvider';
import type { UserListItem } from '@entities/user';
import { registerUser } from '@shared/api/auth/registerUser';
import { getUsers } from '@shared/api/users/getUsers';
import { hasAvailableAction } from '@shared/auth/availableActions';
import { ROLE } from '@shared/constants/roles';
import { addUserButtonSx, roleByTab, roleLabelsById, tabOptions, type UserTab } from './constants';
import { canPatchUserRole, canPatchUserStatus, resolveUserTabFromParam } from './helpers';

const schema = z
  .object({
    login: z.string().min(3, 'Минимум 3 символа'),
    password: z.string().min(6, 'Минимум 6 символов'),
    confirmPassword: z.string().min(6, 'Минимум 6 символов'),
    role_id: z.number({ required_error: 'Выберите роль' }),
    id_parent: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if ((data.role_id === ROLE.ECONOMIST || data.role_id === ROLE.LEAD_ECONOMIST) && !data.id_parent?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Выберите руководителя',
        path: ['id_parent']
      });
    }
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword']
  });

export type AdminUserFormValues = z.infer<typeof schema>;

export const useAdminPage = () => {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLeadEconomist = session?.roleId === ROLE.LEAD_ECONOMIST;
  const isProjectManager = session?.roleId === ROLE.PROJECT_MANAGER;
  const isEconomist = session?.roleId === ROLE.ECONOMIST;
  const isLeadLike = isLeadEconomist || isProjectManager || isEconomist;
  const isAdmin = session?.roleId === ROLE.ADMIN;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<UserTab>(() =>
    isLeadLike ? 'economists' : resolveUserTabFromParam(searchParams.get('users_tab'))
  );
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [canUpdateStatus, setCanUpdateStatus] = useState(false);
  const [canUpdateRole, setCanUpdateRole] = useState(false);
  const [economistAndLeadManagers, setEconomistAndLeadManagers] = useState<UserListItem[]>([]);
  const [projectManagerManagers, setProjectManagerManagers] = useState<UserListItem[]>([]);

  const roleOptions = useMemo(() => {
    if (isLeadLike) {
      return [{ id: ROLE.ECONOMIST, label: roleLabelsById[ROLE.ECONOMIST] }];
    }

    if (session?.roleId === ROLE.SUPERADMIN) {
      return [
        { id: ROLE.ADMIN, label: roleLabelsById[ROLE.ADMIN] },
        { id: ROLE.CONTRACTOR, label: roleLabelsById[ROLE.CONTRACTOR] },
        { id: ROLE.PROJECT_MANAGER, label: roleLabelsById[ROLE.PROJECT_MANAGER] },
        { id: ROLE.LEAD_ECONOMIST, label: roleLabelsById[ROLE.LEAD_ECONOMIST] },
        { id: ROLE.ECONOMIST, label: roleLabelsById[ROLE.ECONOMIST] },
        { id: ROLE.OPERATOR, label: roleLabelsById[ROLE.OPERATOR] }
      ];
    }

    return [
      { id: ROLE.ECONOMIST, label: roleLabelsById[ROLE.ECONOMIST] },
      { id: ROLE.OPERATOR, label: roleLabelsById[ROLE.OPERATOR] }
    ];
  }, [isLeadLike, session?.roleId]);

  const userTabs = useMemo(() => {
    if (isLeadLike) return tabOptions.filter((tab) => tab.value === 'economists');
    if (session?.roleId === ROLE.SUPERADMIN) return tabOptions;
    return tabOptions.filter((tab) => tab.value === 'contractors' || tab.value === 'economists' || tab.value === 'admins');
  }, [isLeadLike, session?.roleId]);

  const canCreateUser = hasAvailableAction(session, '/api/v1/users/register', 'POST');
  const getRoleLabel = useCallback((roleId: number) => roleLabelsById[roleId] ?? `Роль ${roleId}`, []);

  const form = useForm<AdminUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      login: '',
      password: '',
      confirmPassword: '',
      role_id: roleOptions[0]?.id ?? ROLE.ADMIN,
      id_parent: ''
    }
  });

  const { watch, setValue, reset } = form;
  const selectedRoleId = watch('role_id');
  const requiresParent = selectedRoleId === ROLE.ECONOMIST || selectedRoleId === ROLE.LEAD_ECONOMIST;
  const managerOptions = selectedRoleId === ROLE.ECONOMIST ? economistAndLeadManagers : projectManagerManagers;

  const handleTabChange = (value: UserTab) => {
    setActiveTab(value);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('users_tab', value);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (isLeadLike) {
      setActiveTab('economists');
    }
  }, [isLeadLike]);

  useEffect(() => {
    if (!isLeadLike) {
      setActiveTab(resolveUserTabFromParam(searchParams.get('users_tab')));
    }
  }, [isLeadLike, searchParams]);

  useEffect(() => {
    if (!canCreateUser) return;

    if (searchParams.get('create') === '1') {
      setIsDialogOpen(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      }, { replace: true });
    }
  }, [canCreateUser, searchParams, setSearchParams]);

  useEffect(() => {
    if (!isDialogOpen) return;

    const loadManagers = async () => {
      const [leadEconomistsResult, economistsResult, projectManagersResult] = await Promise.allSettled([
        getUsers(ROLE.LEAD_ECONOMIST),
        getUsers(ROLE.ECONOMIST),
        getUsers(ROLE.PROJECT_MANAGER)
      ]);

      const leadEconomists = leadEconomistsResult.status === 'fulfilled' ? leadEconomistsResult.value.items : [];
      const economists = economistsResult.status === 'fulfilled' ? economistsResult.value.items : [];
      const projectManagers = projectManagersResult.status === 'fulfilled' ? projectManagersResult.value.items : [];

      const uniqueManagers = new Map<string, UserListItem>();
      for (const manager of [...leadEconomists, ...economists]) {
        uniqueManagers.set(manager.user_id, manager);
      }

      setEconomistAndLeadManagers(Array.from(uniqueManagers.values()));
      setProjectManagerManagers(projectManagers);
    };

    void loadManagers();
  }, [isDialogOpen]);

  useEffect(() => {
    if (!requiresParent) {
      setValue('id_parent', '');
    }
  }, [requiresParent, setValue]);

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      const response = await getUsers(roleByTab[activeTab]);
      setUsers(response.items);
      setCanUpdateStatus(response.availableActions.some((action) => canPatchUserStatus(action.href, action.method)));
      setCanUpdateRole(response.availableActions.some((action) => canPatchUserRole(action.href, action.method)));
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
      role_id: roleOptions[0]?.id ?? ROLE.ADMIN,
      id_parent: ''
    });
  }, [reset, roleOptions]);

  const handleClose = () => {
    setIsDialogOpen(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('create');
      return next;
    }, { replace: true });
    setErrorMessage(null);
    setSuccessMessage(null);
    resetForm();
  };

  const onSubmit = async (values: AdminUserFormValues) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await registerUser({
        login: values.login,
        password: values.password,
        role_id: values.role_id,
        id_parent: values.id_parent?.trim() || undefined
      });
      setSuccessMessage(`Пользователь ${response.data.user_id} создан.`);
      resetForm();
      await loadUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось создать пользователя');
    }
  };

  return {
    isLeadLike,
    isAdmin,
    isDialogOpen,
    setIsDialogOpen,
    errorMessage,
    successMessage,
    activeTab,
    handleTabChange,
    users,
    isLoadingUsers,
    usersError,
    canUpdateStatus,
    canUpdateRole,
    roleOptions,
    userTabs,
    getRoleLabel,
    canCreateUser,
    requiresParent,
    managerOptions,
    loadUsers,
    handleClose,
    onSubmit,
    form,
    addUserButtonSx
  };
};
