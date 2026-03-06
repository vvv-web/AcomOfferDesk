import { Box, Button,  Stack, Tab, Tabs, Typography } from '@mui/material';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { hasAvailableAction } from '@shared/auth/availableActions';
import { ProfileButton } from '@shared/components/ProfileButton';
import { RoleGuideButton } from '@shared/components/RoleGuideButton';
import { FeedbackButton } from '@shared/components/FeedbackButton';
import { ROLE } from '@shared/constants/roles';

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
  { label: 'Фидбек', to: '/feedback' },
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
  const isSuperadmin = roleId === ROLE.SUPERADMIN;
  const isRequestsListPage = location.pathname === '/requests';
  const isRequestDetailsPage = /^\/requests\/\d+$/.test(location.pathname);
  const isOfferWorkspacePage = /^\/offers\/\d+\/workspace$/.test(location.pathname);
  const canCreateRequest = hasAvailableAction(session, '/api/v1/requests', 'POST');
  const isContractor = roleId === ROLE.CONTRACTOR;
  const isLeadEconomist = roleId === ROLE.LEAD_ECONOMIST;
  const isLeadLike = isLeadEconomist;
  const canLoadOpenRequests = hasAvailableAction(session, '/api/v1/requests/open', 'GET');
  const canLoadOfferedRequests = hasAvailableAction(session, '/api/v1/requests/offered', 'GET');
  const canUseContractorTabs = isContractor && isRequestsListPage && canLoadOpenRequests && canLoadOfferedRequests;
  const canOpenUsersPage = hasAvailableAction(session, '/api/v1/users', 'GET');
  const canRegisterUser = hasAvailableAction(session, '/api/v1/users/register', 'POST');
  const isLeadRequestsTab = isLeadLike && location.pathname.startsWith('/requests');
  const isLeadEconomistsTab = isLeadLike && location.pathname.startsWith('/admin');
  const canUseLeadTabs = isLeadLike && canOpenUsersPage && (isLeadRequestsTab || isLeadEconomistsTab);

  const isAdmin = roleId === ROLE.ADMIN;
  const isProjectManagerDashboard = roleId === ROLE.PROJECT_MANAGER && location.pathname === '/pm-dashboard';
  const isAdminUsersPage = isAdmin && location.pathname.startsWith('/admin');
  const adminUsersTabParam = searchParams.get('users_tab');
  const adminUsersTab: 'contractors' | 'economists' | 'admins' =
    adminUsersTabParam === 'economists' || adminUsersTabParam === 'admins' ? adminUsersTabParam : 'contractors';

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

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 1.2,
              alignItems: 'center',
              '& > .sa-feedback button': { width: '100%', height: 44 },
              '& > .sa-logout': { gridColumn: '1 / -1', height: 44 }
            }}
          >
            <Box className="sa-feedback">
              <FeedbackButton />
            </Box>
            <RoleGuideButton />
            <Button className="sa-logout" variant="outlined" onClick={logout}>
              Выйти
            </Button>
          </Box>
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
          {isProjectManagerDashboard ? (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h5" fontWeight={700} sx={{ color: '#1f3b6d', lineHeight: 1.1 }}>
                Дашборд Руководителя проекта
              </Typography>
            </Stack>
          ) : isRequestDetailsPage ? (
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
          ) : isAdminUsersPage ? (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
              <Tabs
                value={adminUsersTab}
                onChange={(_, value: 'contractors' | 'economists' | 'admins') => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('users_tab', value);
                    return next;
                  }, { replace: true });
                }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab value="contractors" label="Контрагенты" />
                <Tab value="economists" label="Экономисты" />
                <Tab value="admins" label="Администраторы" />
              </Tabs>
              {canRegisterUser ? (
                <Button
                  variant="outlined"
                  sx={{ px: 3, borderRadius: 999, textTransform: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set('users_tab', adminUsersTab);
                    params.set('create', '1');
                    navigate(`/admin?${params.toString()}`);
                  }}
                >
                  Добавить пользователя
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
              {isLeadLike ? 'Добавить пользователя' : 'Создать заявку'}
            </Button>
          ) : (
            <Box />
          )}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <FeedbackButton />
            <RoleGuideButton />
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