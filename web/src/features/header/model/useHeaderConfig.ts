import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { hasAvailableAction } from '@shared/auth/availableActions';
import { buildHeaderConfig } from './buildHeaderConfig';

export const useHeaderConfig = () => {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const contractorTabParam = searchParams.get('tab');
  const contractorTab: 'my' | 'open' = contractorTabParam === 'open' ? 'open' : 'my';

  const adminUsersTabParam = searchParams.get('users_tab');
  const adminUsersTab: 'contractors' | 'economists' | 'admins' =
    adminUsersTabParam === 'economists' || adminUsersTabParam === 'admins' ? adminUsersTabParam : 'contractors';

  const canCreateRequest = hasAvailableAction(session, '/api/v1/requests', 'POST');
  const canLoadOpenRequests = hasAvailableAction(session, '/api/v1/requests/open', 'GET');
  const canLoadOfferedRequests = hasAvailableAction(session, '/api/v1/requests/offered', 'GET');
  const canOpenUsersPage = hasAvailableAction(session, '/api/v1/users', 'GET');
  const canRegisterUser = hasAvailableAction(session, '/api/v1/users/register', 'POST');

  return useMemo(
    () =>
      buildHeaderConfig({
        roleId: session?.roleId ?? null,
        pathname: location.pathname,
        canCreateRequest,
        canRegisterUser,
        canLoadOpenRequests,
        canLoadOfferedRequests,
        canOpenUsersPage,
        contractorTab,
        adminUsersTab,
        onNavigateToDashboard: () => navigate('/pm-dashboard'),
        onNavigateToRequests: () => navigate('/requests'),
        onNavigateToRequestCreate: () => navigate('/requests/create', { state: { backgroundLocation: location } }),
        onNavigateToAdmin: () => navigate('/admin'),
        onNavigateToAdminCreate: () => {
          const params = new URLSearchParams(searchParams);
          if (location.pathname.startsWith('/admin')) {
            params.set('users_tab', adminUsersTab);
          }
          params.set('create', '1');
          navigate(`/admin?${params.toString()}`);
        },
        onNavigateBackToRequests: () => navigate('/requests'),
        onSetContractorTab: (value) => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', value);
            return next;
          }, { replace: true });
        },
        onSetAdminUsersTab: (value) => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('users_tab', value);
            return next;
          }, { replace: true });
        }
      }),
    [
      adminUsersTab,
      canCreateRequest,
      canLoadOfferedRequests,
      canLoadOpenRequests,
      canOpenUsersPage,
      canRegisterUser,
      contractorTab,
      location,
      navigate,
      searchParams,
      session?.roleId,
      setSearchParams
    ]
  );
};
