import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { hasPermission } from '@shared/auth/permissions';
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
  const contractorRequestMatch = location.pathname.match(/^\/requests\/(\d+)\/contractor$/);
  const offerMatch = location.pathname.match(/^\/offers\/(\d+)\/workspace$/);
  const isPmDashboard = location.pathname === '/pm-dashboard';
  const isPmSavings = location.pathname === '/pm-dashboard/savings';
  const isRequestCreatePage = location.pathname === '/requests/create';

  const breadcrumbs = useMemo(() => {
    if (location.pathname === '/admin') {
      return [{ key: 'users', label: 'Пользователи' }];
    }

    if (location.pathname === '/requests') {
      return [{ key: 'requests', label: 'Заявки' }];
    }

    if (isRequestCreatePage) {
      return [
        { key: 'requests', label: 'Заявки', to: '/requests' },
        { key: 'request-create', label: 'Создание заявки' },
      ];
    }

    if (isPmDashboard) {
      return [{ key: 'pm-dashboard', label: 'Дашборд' }];
    }

    if (isPmSavings) {
      return [
        { key: 'pm-dashboard', label: 'Дашборд', to: '/pm-dashboard' },
        { key: 'pm-savings', label: 'Экономия' },
      ];
    }

    if (requestMatch) {
      return [
        { key: 'requests', label: 'Заявки', to: '/requests' },
        { key: `request-${requestMatch[1]}`, label: `Заявка №${requestMatch[1]}` },
      ];
    }

    if (contractorRequestMatch) {
      return [
        { key: 'requests', label: 'Заявки', to: '/requests' },
        { key: `contractor-request-${contractorRequestMatch[1]}`, label: `Заявка №${contractorRequestMatch[1]}` },
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
  }, [contractorRequestMatch, isPmDashboard, isPmSavings, isRequestCreatePage, location.pathname, offerMatch, requestMatch]);

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
