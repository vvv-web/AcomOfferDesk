import { Button, Stack } from '@mui/material';
import { HeaderActions } from './HeaderActions';
import { HeaderNav } from './HeaderNav';
import { HeaderTitle } from './HeaderTitle';
import { SuperadminSidebarHeader } from './SuperadminSidebarHeader';
import type { HeaderConfig } from '../model/types';

type AppHeaderProps = {
  config: HeaderConfig;
  onLogout: () => void;
};

export const AppHeader = ({ config, onLogout }: AppHeaderProps) => {
  if (config.mode === 'hidden') {
    return null;
  }

  if (config.mode === 'sidebar') {
    return <SuperadminSidebarHeader config={config} onLogout={onLogout} />;
  }

  return (
    <Stack component="header" direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
      <Stack spacing={1} sx={{ minWidth: 0 }}>
        {config.backAction ? (
          <Button
            variant="outlined"
            sx={{ px: 4, borderColor: 'primary.main', color: 'primary.main', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}
            onClick={config.backAction.onClick}
          >
            {config.backAction.label}
          </Button>
        ) : null}
        <HeaderNav tabs={config.tabs} activeTab={config.activeTab} onTabChange={config.onTabChange} />
        <HeaderTitle title={config.title} />
      </Stack>

      <HeaderActions
        actions={config.actions}
        showFeedback={config.showFeedback}
        showRoleGuide={config.showRoleGuide}
        showProfile={config.showProfile}
        showLogout={config.showLogout}
        onLogout={onLogout}
      />
    </Stack>
  );
};
