import { Box, Stack } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { AppHeader, useHeaderConfig } from '@features/header';
import { HeaderActions } from '@features/header/ui/HeaderActions';
import { AppFooter } from '@shared/components/AppFooter';

export const AppLayout = () => {
  const { logout } = useAuth();
  const headerConfig = useHeaderConfig();
  const isSidebarLayout = headerConfig.mode === 'sidebar';
  const isHiddenHeader = headerConfig.mode === 'hidden';

  if (isSidebarLayout) {
    return (
      <Stack sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' },
            alignItems: { lg: 'start' },
            gap: { xs: 2, lg: 2.5 },
            p: { xs: 1.5, md: 2 }
          }}
        >
          <AppHeader config={headerConfig} onLogout={logout} />
          <Stack component="section" spacing={2} sx={{ minWidth: 0 }}>
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

            <Box component="main">
              <Outlet />
            </Box>
          </Stack>
        </Box>

        <AppFooter />
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

        <Box component="main">
          <Outlet />
        </Box>
      </Box>

      <AppFooter />
    </Stack>
  );
};
