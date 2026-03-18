import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  type SelectChangeEvent
} from '@mui/material';
import { UsersTable } from '@features/admin/components/UsersTable';
import { useAdminPage } from '../model/useAdminPage';
import { ROLE } from '@shared/constants/roles';
import type { UserTab } from '../model/constants';

export const AdminPageView = () => {
  const {
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
  } = useAdminPage();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = form;

  const selectedRoleId = watch('role_id');

  const handleRoleSelectChange = (event: SelectChangeEvent<UserTab>) => {
    handleTabChange(event.target.value as UserTab);
  };

  return (
    <Stack spacing={2}>
      {!isLeadLike && !isAdmin ? (
        <Stack direction="row" gap={1.5} alignItems="center" flexWrap="nowrap" sx={{ width: '100%', overflowX: 'auto', pb: 0.5 }}>
          <Select
            size="small"
            value={activeTab}
            onChange={handleRoleSelectChange}
            sx={{ minWidth: { xs: 220, sm: 300 }, flexShrink: 0 }}
          >
            {userTabs.map((tab) => (
              <MenuItem key={tab.value} value={tab.value}>{tab.label}</MenuItem>
            ))}
          </Select>
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
        allowedRoleOptions={[ROLE.ADMIN, ROLE.ECONOMIST]}
        onStatusUpdated={loadUsers}
      />

      <Dialog
        open={isDialogOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: { xs: 2.5, md: 3 } } }}
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

            {requiresParent ? (
              <TextField
                label={selectedRoleId === ROLE.ECONOMIST ? 'Руководитель (экономист или ведущий экономист)' : 'Руководитель (руководитель проекта)'}
                select
                error={Boolean(errors.id_parent)}
                helperText={errors.id_parent?.message ?? (managerOptions.length ? '' : 'Нет доступных руководителей')}
                {...register('id_parent')}
              >
                {managerOptions.map((manager) => (
                  <MenuItem key={manager.user_id} value={manager.user_id}>
                    {manager.full_name ? `${manager.full_name} (${manager.user_id})` : manager.user_id}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}

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
