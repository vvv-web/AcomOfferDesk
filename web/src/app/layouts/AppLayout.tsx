import { Box, Button, Stack, Tab, Tabs } from '@mui/material';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { hasAvailableAction } from '@shared/auth/availableActions';
import { ProfileButton } from '@shared/components/ProfileButton';

const navLinkStyles = {
  textDecoration: 'none'
};

type NavItem = {
  label: string;
  to?: string;
  disabled?: boolean;
};

const superadminItems: NavItem[] = [
  { label: 'Пользователи', to: '/admin' },
  { label: 'Заявки', to: '/requests' },
  { label: 'Офферы', disabled: true },
  { label: 'Роли', disabled: true }
];


export const AppLayout = () => {
  const { session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const contractorTabParam = searchParams.get('tab');
  const contractorTab: 'my' | 'open' = contractorTabParam === 'open' ? 'open' : 'my';
  const roleId = session?.roleId ?? null;
  const isSuperadmin = roleId === 1;
  const isRequestsListPage = location.pathname === '/requests';
  const isRequestDetailsPage = /^\/requests\/\d+$/.test(location.pathname);
  const isOfferWorkspacePage = /^\/offers\/\d+\/workspace$/.test(location.pathname);
  const canCreateRequest = hasAvailableAction(session, '/api/v1/requests', 'POST');
  const isContractor = roleId === 5;
  const isLeadEconomist = roleId === 3;
  const canLoadOpenRequests = hasAvailableAction(session, '/api/v1/requests/open', 'GET');
  const canLoadOfferedRequests = hasAvailableAction(session, '/api/v1/requests/offered', 'GET');
  const canUseContractorTabs = isContractor && isRequestsListPage && canLoadOpenRequests && canLoadOfferedRequests;
  const canOpenUsersPage = hasAvailableAction(session, '/api/v1/users', 'GET');
  const canRegisterUser = hasAvailableAction(session, '/api/v1/users/register', 'POST');
  const isLeadRequestsTab = isLeadEconomist && location.pathname.startsWith('/requests');
  const isLeadEconomistsTab = isLeadEconomist && location.pathname.startsWith('/admin');
  const canUseLeadTabs = isLeadEconomist && canOpenUsersPage && (isLeadRequestsTab || isLeadEconomistsTab);

  const sidebarButtons = (
    <Stack spacing={1.8}>
      {superadminItems.map((item) => {
        if (!item.to) {
          return (
            <Button key={item.label} variant="outlined" disabled={item.disabled} sx={{ height: 44 }}>
              {item.label}
            </Button>
          );
        }
        return (
          <NavLink key={item.to} to={item.to} style={navLinkStyles}>
            {({ isActive }) => (
              <Button
                variant="outlined"
                sx={(theme) => ({
                  height: 44,
                  width: '100%',
                  backgroundColor: isActive ? theme.palette.primary.light : theme.palette.background.paper
                })}
              >
                {item.label}
              </Button>
            )}
          </NavLink>
        );
      })}
    </Stack>
  );

  if (isSuperadmin) {
    return (
      <Box
        sx={{
          minHeight: { xs: 420, lg: '100%' },
          height: { lg: '100%' },
          backgroundColor: 'background.default',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' },
          gap: { xs: 2, lg: 2.5 },
          p: { xs: 1.5, md: 2 }
        }}
      >
        <Stack
          component="aside"
          justifyContent="space-between"
          sx={(theme) => ({
            borderRadius: 3,
            backgroundColor: theme.palette.background.paper,
            p: 2,
            minHeight: { xs: 'auto', lg: 'calc(100vh - 32px)' }
          })}
        >
          {sidebarButtons}

          <Stack spacing={1.2}>
            <Button variant="outlined" onClick={logout} sx={{ height: 44 }}>
              Выйти
            </Button>
          </Stack>
        </Stack>
        <Stack component="section" spacing={2} sx={{ minWidth: 0 }}>
          {isRequestsListPage && canCreateRequest ? (
            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                sx={{ px: 3, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
                onClick={() => navigate('/requests/create', { state: { backgroundLocation: location } })}
              >
                Создать заявку
              </Button>
            </Stack>
          ) : null}

          <Box component="main">
            <Outlet />
          </Box>
        </Stack>
      </Box>
    );
  }


  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        p: isOfferWorkspacePage ? 0 : { xs: 1.5, md: 2.5 }
      }}
    >
      {isOfferWorkspacePage ? null : (
        <Stack component="header" direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          {isRequestDetailsPage ? (
            <Button
              variant="outlined"
              sx={{ px: 4, borderColor: 'primary.main', color: 'primary.main', whiteSpace: 'nowrap' }}
              onClick={() => navigate('/requests')}
            >
              К списку заявок
            </Button>
          ) : canUseContractorTabs ? (
            <Tabs
              value={contractorTab}
              onChange={(_, value: 'my' | 'open') => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('tab', value);
                  return next;
                }, { replace: true });
              }}
            >
              <Tab value="my" label="Мои заявки" />
              <Tab value="open" label="Актуальные заявки" />
            </Tabs>
          ) : canUseLeadTabs ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Tabs
                value={location.pathname === '/admin' ? 'economists' : 'requests'}
                onChange={(_, value: 'economists' | 'requests') => {
                  navigate(value === 'economists' ? '/admin' : '/requests');
                }}
              >
                <Tab value="requests" label="Заявки" />
                <Tab value="economists" label="Экономисты" />
              </Tabs>
              {(isLeadRequestsTab ? canCreateRequest : canRegisterUser) ? (
                <Button
                  variant="outlined"
                  sx={{ px: 3, borderRadius: 999, textTransform: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (isLeadRequestsTab) {
                      navigate('/requests/create', { state: { backgroundLocation: location } });
                      return;
                    }
                    navigate('/admin?create=1');
                  }}
                >
                  {isLeadRequestsTab ? 'Создать заявку' : 'Добавить экономиста'}
                </Button>
              ) : null}
            </Stack>
          ) : isRequestsListPage && canCreateRequest ? (
            <Button
              variant="contained"
              sx={{ px: 3, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
              onClick={() => {
                navigate('/requests/create', { state: { backgroundLocation: location } });
              }}
            >
              {isLeadEconomist ? 'Добавить пользователя' : 'Создать заявку'}
            </Button>
          ) : (
            <Box />
          )}
          <Stack direction="row" spacing={3} alignItems="center">
            <ProfileButton />
            <Button variant="outlined" onClick={logout}>
              Выйти
            </Button>
          </Stack>
        </Stack>
      )}

      <Box component="main">
        <Outlet />
      </Box>
    </Box>
  );
};