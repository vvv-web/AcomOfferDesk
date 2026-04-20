import { Box, Stack, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { AppHeader, useHeaderConfig } from '@features/header';
import { AppFooter } from '@shared/components/AppFooter';
import { BreadcrumbsNav } from '@shared/components/BreadcrumbsNav';

export const AppLayout = () => {
  const theme = useTheme();
  const isCompactViewport = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  const { logout } = useAuth();
  const headerConfig = useHeaderConfig();
  const isSidebarLayout = headerConfig.mode !== 'hidden';
  const isHiddenHeader = headerConfig.mode === 'hidden';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isSidebarInIconMode = isCompactViewport || isSidebarCollapsed;
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
      <Stack
        sx={{
          minHeight: '100vh',
          height: '100vh',
          backgroundColor: 'background.default',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            flex: 1,
            minHeight: '100vh',
            display: 'grid',
            gridTemplateColumns: isSidebarInIconMode ? '88px minmax(0, 1fr)' : '248px minmax(0, 1fr)',
            gridTemplateRows: '1fr',
            alignItems: 'stretch',
            gap: 0,
            p: 0,
            transition: 'grid-template-columns 0.24s ease',
          }}
        >
          <AppHeader
            config={headerConfig}
            onLogout={logout}
            sidebarCollapsed={isSidebarInIconMode}
            onToggleSidebarCollapse={
              isCompactViewport ? undefined : () => setIsSidebarCollapsed((currentState) => !currentState)
            }
          />
          <Stack
            component="section"
            spacing={2}
            sx={{
              minWidth: 0,
              minHeight: '100vh',
              px: { xs: 1.5, md: 2 },
              py: { xs: 1.5, md: 2 },
              overflowY: 'auto',
            }}
          >
            {breadcrumbItems.length > 0 ? <BreadcrumbsNav items={breadcrumbItems} /> : null}
            <Box component="main" sx={{ minWidth: 0, pb: 0.5, flex: 1 }}>
              <Outlet />
            </Box>

            <AppFooter />
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
