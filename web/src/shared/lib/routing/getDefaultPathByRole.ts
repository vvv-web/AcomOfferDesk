import { ROLE } from '@shared/constants/roles';

export const getDefaultPathByRole = (roleId: number) =>
  roleId === ROLE.PROJECT_MANAGER
    ? '/pm-dashboard'
    : roleId === ROLE.SUPERADMIN || roleId === ROLE.ADMIN
      ? '/admin'
      : '/requests';
