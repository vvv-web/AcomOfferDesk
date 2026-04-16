import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { hasPermission } from '@shared/auth/permissions';
import { ROLE } from '@shared/constants/roles';
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

  const canCreateRequest = hasPermission(session, 'requests.create');
  const canLoadOpenRequests = hasPermission(session, 'requests.open.read');
  const canLoadOfferedRequests = hasPermission(session, 'requests.offered.read');
  const canOpenUsersPage = hasPermission(session, 'users.read');
  const canRegisterUser = hasPermission(session, 'users.create');
  const requestMatch = location.pathname.match(/^\/requests\/(\d+)$/);
  const offerMatch = location.pathname.match(/^\/offers\/(\d+)\/workspace$/);
  const isSuperadmin = session?.roleId === ROLE.SUPERADMIN;

  const breadcrumbs = useMemo(() => {
    if (!isSuperadmin) {
      return [];
    }

    if (location.pathname === '/admin') {
      return [{ key: 'users', label: 'Пользователи' }];
    }

    if (location.pathname === '/requests') {
      return [{ key: 'requests', label: 'Заявки' }];
    }

    if (requestMatch) {
      return [
        { key: 'requests', label: 'Заявки', to: '/requests' },
        { key: `request-${requestMatch[1]}`, label: `Заявка №${requestMatch[1]}` },
      ];
    }

    if (offerMatch) {
      return [
        { key: 'requests', label: 'Заявки', to: '/requests' },
        { key: 'request-details', label: 'Заявка', to: '/requests' },
        { key: `offer-${offerMatch[1]}`, label: `КП №${offerMatch[1]}` },
      ];
    }

    return [];
  }, [isSuperadmin, location.pathname, offerMatch, requestMatch]);

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
        breadcrumbs,
        contractorTab,
        adminUsersTab,
        onNavigateToDashboard: () => navigate('/pm-dashboard'),
        onNavigateToSavings: () => navigate('/pm-dashboard/savings'),
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
      breadcrumbs,
      location,
      navigate,
      searchParams,
      session?.roleId,
      setSearchParams
    ]
  );
};
