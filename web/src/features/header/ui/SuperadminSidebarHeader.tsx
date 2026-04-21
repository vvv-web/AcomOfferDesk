import AddRounded from '@mui/icons-material/AddRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import AttachMoneyRounded from '@mui/icons-material/AttachMoneyRounded';
import FilePresentOutlinedIcon from '@mui/icons-material/FilePresentOutlined';
import GroupRounded from '@mui/icons-material/GroupRounded';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import KeyboardArrowLeftRounded from '@mui/icons-material/KeyboardArrowLeftRounded';
import KeyboardArrowRightRounded from '@mui/icons-material/KeyboardArrowRightRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import ModeEditOutline from '@mui/icons-material/ModeEditOutline';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import SpaceDashboardRounded from '@mui/icons-material/SpaceDashboardRounded';
import FeedbackOutlined from '@mui/icons-material/FeedbackOutlined';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ActionButton } from '@shared/components/ActionButton';
import { useAuth } from '@app/providers/AuthProvider';
import { FeedbackButton } from '@shared/components/FeedbackButton';
import { NormativeFileButton } from '@shared/components/NormativeFileButton';
import { ProfileButton } from '@shared/components/ProfileButton';
import { RoleGuideButton } from '@shared/components/RoleGuideButton';
import { ROLE } from '@shared/constants/roles';
import { SidebarMenuButton } from '@shared/components/SidebarMenuButton';
import type { HeaderConfig } from '../model/types';

const navLinkStyles = { textDecoration: 'none', display: 'block', width: '100%' } as const;

type SuperadminSidebarHeaderProps = {
  config: HeaderConfig;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse?: () => void;
};

export const SuperadminSidebarHeader = ({
  config,
  onLogout,
  collapsed,
  onToggleCollapse,
}: SuperadminSidebarHeaderProps) => {
  const theme = useTheme();
  const { session } = useAuth();
  const [isCompactHeight, setIsCompactHeight] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerHeight <= 760 : false
  );
  const [isEdgeHovered, setIsEdgeHovered] = useState(false);
  const [isToggleHovered, setIsToggleHovered] = useState(false);
  const [isToggleVisible, setIsToggleVisible] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsCompactHeight(window.innerHeight <= 760);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const shouldShow = Boolean(onToggleCollapse) && (isEdgeHovered || isToggleHovered);
    if (shouldShow) {
      setIsToggleVisible(true);
      return;
    }

    const hideTimeout = window.setTimeout(() => {
      setIsToggleVisible(false);
    }, 160);

    return () => {
      window.clearTimeout(hideTimeout);
    };
  }, [isEdgeHovered, isToggleHovered, onToggleCollapse]);

  const iconByKey = useMemo(
    () => ({
      users: <PersonOutlineRounded fontSize="small" />,
      requests: <InsertDriveFileOutlined fontSize="small" />,
      feedback: <FeedbackOutlined fontSize="small" />,
      offers: <FilePresentOutlinedIcon fontSize="small" />,
      roles: <GroupRounded fontSize="small" />,
      contact: <ModeEditOutline fontSize="small" />,
      logout: <LogoutRounded fontSize="small" />,
      dashboard: <SpaceDashboardRounded fontSize="small" />,
      savings: <AttachMoneyRounded fontSize="small" />,
      employees: <GroupRounded fontSize="small" />,
      economists: <GroupRounded fontSize="small" />,
      contractors: <GroupRounded fontSize="small" />,
      admins: <PersonOutlineRounded fontSize="small" />,
      my: <FilePresentOutlinedIcon fontSize="small" />,
      open: <InsertDriveFileOutlined fontSize="small" />,
    }),
    []
  );

  const topItems = (config.sidebarItems ?? []).filter((item) => !item.isBottomItem && item.key !== 'logout');
  const isSuperadmin = session?.roleId === ROLE.SUPERADMIN;

  return (
    <Stack
      component="aside"
      justifyContent="space-between"
      sx={{
        width: '100%',
        position: 'sticky',
        top: 0,
        minHeight: '100vh',
        height: '100vh',
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        px: collapsed ? 1 : 1.5,
        py: 1.5,
        overflow: 'hidden',
        transition: 'padding 0.24s ease'
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent={collapsed ? 'center' : 'space-between'} sx={{ minHeight: 44, mb: 1.8 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
            {collapsed ? 'A' : 'AcomOfferDesk'}
          </Typography>
        </Stack>

        <Stack spacing={1.25} sx={{ overflowY: { lg: 'auto' }, pr: { lg: 0.5 } }}>
          {config.title && !collapsed ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.4, pb: 0.25, fontWeight: 600 }}>
              {config.title}
            </Typography>
          ) : null}

          {topItems.map((item) => {
            const icon = item.icon ?? iconByKey[item.key as keyof typeof iconByKey];
            if (!item.to) {
              return (
                <SidebarMenuButton
                  key={item.key}
                  label={item.label}
                  icon={icon}
                  collapsed={collapsed}
                  disabled={item.disabled}
                />
              );
            }

            return (
              <NavLink key={item.key} to={item.to} style={navLinkStyles}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    label={item.label}
                    icon={icon}
                    collapsed={collapsed}
                    active={isActive}
                    disabled={item.disabled}
                  />
                )}
              </NavLink>
            );
          })}

          {config.tabs.map((tab) => (
            <SidebarMenuButton
              key={tab.key}
              label={tab.label}
              icon={iconByKey[tab.key as keyof typeof iconByKey] ?? <InsertDriveFileOutlined fontSize="small" />}
              collapsed={collapsed}
              active={config.activeTab === tab.value}
              onClick={() => config.onTabChange?.(tab.value)}
            />
          ))}

          {config.backAction ? (
            <SidebarMenuButton
              label={config.backAction.label}
              icon={<ArrowBackRounded fontSize="small" />}
              collapsed={collapsed}
              onClick={config.backAction.onClick}
            />
          ) : null}

          {config.actions.map((action) => (
            <SidebarMenuButton
              key={action.key}
              label={action.label}
              icon={<AddRounded fontSize="small" />}
              collapsed={collapsed}
              onClick={action.onClick}
            />
          ))}

          {isSuperadmin ? null : <NormativeFileButton iconOnly={collapsed} sidebar />}
        </Stack>

        <Stack
          spacing={1.25}
          sx={{
            mt: isCompactHeight ? 2 : 'auto',
            pt: isCompactHeight ? 2 : 0,
            borderTop: isCompactHeight ? '1px solid' : 'none',
            borderColor: 'divider'
          }}
        >
          {config.showRoleGuide ? <RoleGuideButton iconOnly={collapsed} sidebar /> : null}
          {config.showFeedback ? <FeedbackButton iconOnly={collapsed} sidebar /> : null}

          {config.showProfile ? (
            collapsed ? (
              <>
                <ProfileButton iconOnly sidebar />
                <SidebarMenuButton
                  label="Выйти"
                  icon={<LogoutRounded fontSize="small" />}
                  collapsed
                  onClick={onLogout}
                />
              </>
            ) : (
              <Stack direction="row" spacing={1}>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <ProfileButton sidebar />
                </Stack>
                <Tooltip title="Выйти" placement="right" enterDelay={150}>
                  <Box component="span" sx={{ display: 'inline-flex' }}>
                    <ActionButton
                      kind="custom"
                      showNavigationIcons={false}
                      onClick={onLogout}
                      aria-label="Выйти"
                      sx={{
                        minWidth: 56,
                        width: 56,
                        minHeight: 42,
                        borderRadius: `${theme.acomShape.buttonRadius}px !important`,
                      }}
                    >
                      <LogoutRounded fontSize="small" />
                    </ActionButton>
                  </Box>
                </Tooltip>
              </Stack>
            )
          ) : config.showLogout ? (
            <SidebarMenuButton
              label="Выйти"
              icon={<LogoutRounded fontSize="small" />}
              collapsed={collapsed}
              onClick={onLogout}
            />
          ) : null}
        </Stack>

        {onToggleCollapse ? (
          <>
            <Stack
              component="div"
              onMouseEnter={() => setIsEdgeHovered(true)}
              onMouseLeave={() => setIsEdgeHovered(false)}
              sx={{ position: 'absolute', top: 0, right: 0, width: 28, height: '100%', zIndex: 3 }}
            />

            <IconButton
              onClick={onToggleCollapse}
              size="small"
              onMouseEnter={() => setIsToggleHovered(true)}
              onMouseLeave={() => setIsToggleHovered(false)}
              sx={(theme) => ({
                position: 'absolute',
                top: '50%',
                right: 8,
                transform: isToggleVisible ? 'translate(0, -50%)' : 'translate(8px, -50%)',
                opacity: isToggleVisible ? 1 : 0,
                pointerEvents: isToggleVisible ? 'auto' : 'none',
                zIndex: 4,
                borderRadius: `${theme.acomShape.controlRadius}px`,
                border: '1px solid',
                borderColor: 'divider',
                color: 'text.secondary',
                bgcolor: 'background.paper',
                transition: 'opacity 180ms ease, transform 180ms ease, border-color 180ms ease, color 180ms ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  color: 'primary.main'
                }
              })}
            >
              {collapsed ? <KeyboardArrowRightRounded fontSize="small" /> : <KeyboardArrowLeftRounded fontSize="small" />}
            </IconButton>
          </>
        ) : null}
      </Stack>
    </Stack>
  );
};


