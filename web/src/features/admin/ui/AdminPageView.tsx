import {
  Alert,
  Box,
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
import { alpha, type Theme } from '@mui/material/styles';
import { UsersTable } from '@features/admin/components/UsersTable';
import { useAdminPage } from '../model/useAdminPage';
import { ROLE } from '@shared/constants/roles';
import type { UserTab } from '../model/constants';

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

const inputFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1,
    backgroundColor: 'background.paper'
  }
};

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
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogContent sx={dialogContentSx}>
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={600} lineHeight={1}>
                Создание нового пользователя
              </Typography>
              <TextField
                label="Роль пользователя"
                select
                error={Boolean(errors.role_id)}
                helperText={errors.role_id?.message}
                defaultValue={roleOptions[0]?.id ?? 2}
                {...register('role_id', { valueAsNumber: true })}
                sx={inputFieldSx}
              >
                {roleOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Логин" error={Boolean(errors.login)} helperText={errors.login?.message} {...register('login')} sx={inputFieldSx} />
              <TextField
                label="Пароль"
                type="password"
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                {...register('password')}
                sx={inputFieldSx}
              />
              <TextField
                label="Повторите пароль"
                type="password"
                error={Boolean(errors.confirmPassword)}
                helperText={errors.confirmPassword?.message}
                {...register('confirmPassword')}
                sx={inputFieldSx}
              />

              {requiresParent ? (
                <TextField
                  label={selectedRoleId === ROLE.ECONOMIST ? 'Руководитель (экономист или ведущий экономист)' : 'Руководитель (руководитель проекта)'}
                  select
                  error={Boolean(errors.id_parent)}
                  helperText={errors.id_parent?.message ?? (managerOptions.length ? '' : 'Нет доступных руководителей')}
                  {...register('id_parent')}
                  sx={inputFieldSx}
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

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isSubmitting}
                sx={{ borderRadius: 1, textTransform: 'none', py: 1.25, fontSize: 16, fontWeight: 700, boxShadow: 'none' }}
              >
                {isSubmitting ? 'Сохранение...' : 'Создать пользователя'}
              </Button>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>
    </Stack>
  );
};
