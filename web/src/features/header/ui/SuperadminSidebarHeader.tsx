import { Button, Stack } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { HeaderActions } from './HeaderActions';
import type { HeaderConfig } from '../model/types';

const navLinkStyles = {
  textDecoration: 'none'
};

type SuperadminSidebarHeaderProps = {
  config: HeaderConfig;
  onLogout: () => void;
};

export const SuperadminSidebarHeader = ({ config, onLogout }: SuperadminSidebarHeaderProps) => (
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
    <Stack spacing={1.8}>
      {(config.sidebarItems ?? []).map((item) => {
        if (!item.to) {
          return (
            <Button key={item.key} variant="outlined" disabled={item.disabled} sx={{ height: 44 }}>
              {item.label}
            </Button>
          );
        }

        return (
          <NavLink key={item.key} to={item.to} style={navLinkStyles}>
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

    <HeaderActions
      actions={[]}
      showFeedback={config.showFeedback}
      showRoleGuide={config.showRoleGuide}
      showProfile={false}
      showLogout={config.showLogout}
      onLogout={onLogout}
      sidebar
    />
  </Stack>
);
