import { Box, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { AppHeader, useHeaderConfig } from '@features/header';
import { HeaderActions } from '@features/header/ui/HeaderActions';
import { AppFooter } from '@shared/components/AppFooter';
import { BreadcrumbsNav } from '@shared/components/BreadcrumbsNav';

export const AppLayout = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const headerConfig = useHeaderConfig();
  const isSidebarLayout = headerConfig.mode === 'sidebar';
  const isHiddenHeader = headerConfig.mode === 'hidden';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const breadcrumbItems = useMemo(
    () =>
      (headerConfig.breadcrumbs ?? []).map((item) => ({
        key: item.key,
        label: item.label,
        onClick: item.to ? () => navigate(item.to!) : undefined,
      })),
    [headerConfig.breadcrumbs, navigate]
  );

  if (isSidebarLayout) {
    return (
      <Stack sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              lg: isSidebarCollapsed ? '88px minmax(0, 1fr)' : '280px minmax(0, 1fr)',
            },
            alignItems: { lg: 'stretch' },
            gap: 0,
            p: 0,
            transition: 'grid-template-columns 0.24s ease',
          }}
        >
          <AppHeader
            config={headerConfig}
            onLogout={logout}
            sidebarCollapsed={isSidebarCollapsed}
            onToggleSidebarCollapse={() => setIsSidebarCollapsed((currentState) => !currentState)}
          />
          <Stack
            component="section"
            spacing={2}
            sx={{
              minWidth: 0,
              minHeight: '100vh',
              px: { xs: 1.5, md: 2 },
              py: { xs: 1.5, md: 2 },
            }}
          >
            {breadcrumbItems.length > 0 ? <BreadcrumbsNav items={breadcrumbItems} /> : null}
            {headerConfig.actions.length ? (
              <Stack direction="row" justifyContent="flex-end">
                <HeaderActions
                  actions={headerConfig.actions}
                  showFeedback={false}
                  showRoleGuide={false}
                  showProfile={false}
                  showLogout={false}
                  onLogout={logout}
                />
              </Stack>
            ) : null}

            <Box component="main" sx={{ minWidth: 0, pb: 0.5 }}>
              <Outlet />
            </Box>
          </Stack>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Box
        sx={{
          flex: 1,
          p: isHiddenHeader ? 0 : { xs: 1.5, md: 2.5 }
        }}
      >
        {isHiddenHeader ? null : <AppHeader config={headerConfig} onLogout={logout} />}
        {!isHiddenHeader && breadcrumbItems.length > 0 ? <BreadcrumbsNav items={breadcrumbItems} /> : null}

        <Box component="main">
          <Outlet />
        </Box>
      </Box>

      <AppFooter />
    </Stack>
  );
};
