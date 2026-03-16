import { useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { AppRoutes } from '@app/routes/AppRoutes';
import { ROLE } from '@shared/constants/roles';

export const App = () => {
  const { session } = useAuth();
  const location = useLocation();
  const state = location.state as { backgroundLocation?: Location } | null;

  const defaultPath =
    session?.roleId === ROLE.PROJECT_MANAGER
      ? '/pm-dashboard'
      : session?.roleId === ROLE.SUPERADMIN || session?.roleId === ROLE.ADMIN
        ? '/admin'
        : '/requests';

  return (
    <AppRoutes
      defaultPath={defaultPath}
      hasSession={Boolean(session)}
      roleId={session?.roleId}
      location={location}
      backgroundLocation={state?.backgroundLocation}
    />
  );
};
