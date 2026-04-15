import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import NavigateBeforeRounded from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRounded from '@mui/icons-material/NavigateNextRounded';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import SentimentSatisfiedAltRounded from '@mui/icons-material/SentimentSatisfiedAltRounded';
import { Box, ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { NavLink, useLocation } from 'react-router-dom';
import { ActionButton } from '@shared/ui/buttons';
import { HeaderActions } from './HeaderActions';
import type { HeaderConfig } from '../model/types';

const SIDEBAR_EXPANDED_WIDTH = 248;
const SIDEBAR_COLLAPSED_WIDTH = 84;
const AUTO_COLLAPSE_BREAKPOINT = 1200;

const getSidebarItemIcon = (key: string) => {
  if (key === 'users') {
    return <PersonOutlineRounded fontSize="small" />;
  }
  if (key === 'requests') {
    return <InsertDriveFileOutlined fontSize="small" />;
  }
  if (key === 'feedback') {
    return <SentimentSatisfiedAltRounded fontSize="small" />;
  }
  if (key === 'offers') {
    return <InsertDriveFileOutlined fontSize="small" />;
  }
  if (key === 'roles') {
    return <PersonOutlineRounded fontSize="small" />;
  }
  return <InsertDriveFileOutlined fontSize="small" />;
};

type SidebarNavButtonProps = {
  label: string;
  icon: ReactNode;
  collapsed: boolean;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
};

const SidebarNavButton = ({ label, icon, collapsed, disabled, active, onClick }: SidebarNavButtonProps) => {
  const theme = useTheme();

  return (
    <Tooltip title={label} placement="right" enterDelay={120} disableHoverListener={!collapsed}>
      <Box sx={{ width: '100%', minWidth: 0 }}>
        <ActionButton
          kind="custom"
          selected={Boolean(active)}
          disabled={disabled}
          showNavigationIcons={false}
          onClick={onClick}
          sx={{
            width: '100%',
            minWidth: 0,
            minHeight: 42,
            borderRadius: `${theme.acomShape.buttonRadius}px !important`,
            justifyContent: collapsed ? 'center' : 'flex-start',
            px: collapsed ? 0 : 1.75,
            gap: collapsed ? 0 : 1.25,
            transition: 'background-color 0.28s ease, border-color 0.28s ease, color 0.28s ease, padding 0.32s ease, gap 0.32s ease',
            '&:focus-visible': {
              outline: `2px solid ${alpha(theme.palette.primary.main, 0.28)}`,
              outlineOffset: 1
            }
          }}
        >
          <Stack component="span" sx={{ display: 'inline-flex', lineHeight: 1 }}>
            {icon}
          </Stack>
          <Typography
            sx={{
              maxWidth: collapsed ? 0 : 180,
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-4px)' : 'translateX(0)',
              overflow: 'hidden',
              textOverflow: 'clip',
              whiteSpace: 'nowrap',
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              lineHeight: 1.2,
              transition: 'max-width 0.34s ease, opacity 0.24s ease, transform 0.34s ease'
            }}
          >
            {label}
          </Typography>
        </ActionButton>
      </Box>
    </Tooltip>
  );
};

type SuperadminSidebarHeaderProps = {
  config: HeaderConfig;
  onLogout: () => void;
};

export const SuperadminSidebarHeader = ({ config, onLogout }: SuperadminSidebarHeaderProps) => {
  const theme = useTheme();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAutoCollapsed, setIsAutoCollapsed] = useState(false);
  const [isCompactHeight, setIsCompactHeight] = useState(false);
  const [isEdgeHovered, setIsEdgeHovered] = useState(false);
  const [isToggleHovered, setIsToggleHovered] = useState(false);

  useEffect(() => {
    const syncViewport = () => {
      const shouldAutoCollapse = window.innerWidth <= AUTO_COLLAPSE_BREAKPOINT;
      setIsCompactHeight(window.innerHeight <= 760);

      if (shouldAutoCollapse) {
        setIsAutoCollapsed(true);
        setIsCollapsed(true);
        return;
      }

      if (isAutoCollapsed) {
        setIsAutoCollapsed(false);
        setIsCollapsed(false);
      }
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
    };
  }, [isAutoCollapsed]);

  const currentWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  const showToggleTab = isEdgeHovered || isToggleHovered;

  return (
    <Stack
      component="aside"
      sx={{
        width: currentWidth,
        minWidth: currentWidth,
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        overflowX: 'hidden',
        transition: 'width 420ms cubic-bezier(0.22, 1, 0.36, 1), min-width 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'width',
        flexShrink: 0
      }}
    >
      <Stack sx={{ height: '100%', minWidth: 0, overflowX: 'hidden' }}>
        <Stack
          sx={{
            px: isCollapsed ? 1.25 : 2,
            minHeight: 66,
            alignItems: isCollapsed ? 'center' : 'stretch',
            justifyContent: 'center',
            transition: 'padding 420ms cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          <Stack sx={{ position: 'relative', minHeight: 26, alignItems: isCollapsed ? 'center' : 'flex-start', justifyContent: 'center' }}>
            <Typography
              sx={{
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                opacity: isCollapsed ? 0 : 1,
                transform: isCollapsed ? 'translateX(-4px)' : 'translateX(0)',
                transition: 'opacity 190ms ease, transform 190ms ease'
              }}
            >
              AcomOfferDesk
            </Typography>
            <Typography
              sx={{
                position: 'absolute',
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                opacity: isCollapsed ? 1 : 0,
                transform: isCollapsed ? 'scale(1)' : 'scale(0.95)',
                transition: 'opacity 190ms ease, transform 190ms ease'
              }}
            >
              A
            </Typography>
          </Stack>
        </Stack>

        <Stack
          spacing={1.25}
          sx={{
            flex: 1,
            px: isCollapsed ? 1.25 : 2,
            pb: 2,
            overflowY: { lg: 'auto' },
            overflowX: 'hidden',
            minWidth: 0,
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar:horizontal': {
              height: 0
            },
            transition: 'padding 420ms cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          {(config.sidebarItems ?? []).map((item) => {
            const icon = getSidebarItemIcon(item.key);

            if (item.to) {
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  style={{ textDecoration: 'none', display: 'block', width: '100%', minWidth: 0 }}
                >
                  {({ isActive }) => (
                    <SidebarNavButton
                      label={item.label}
                      icon={icon}
                      collapsed={isCollapsed}
                      disabled={item.disabled}
                      active={isActive || location.pathname === item.to}
                    />
                  )}
                </NavLink>
              );
            }

            return (
              <SidebarNavButton
                key={item.key}
                label={item.label}
                icon={icon}
                collapsed={isCollapsed}
                disabled={item.disabled}
                active={false}
              />
            );
          })}

          <Stack
            spacing={1.2}
            sx={{
              mt: isCompactHeight ? 2 : 'auto',
              pt: isCompactHeight ? 2 : 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              opacity: isCollapsed ? 0 : 1,
              pointerEvents: isCollapsed ? 'none' : 'auto',
              transition: 'opacity 0.2s ease'
            }}
          >
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
        </Stack>

        <Stack
          component="div"
          onMouseEnter={() => setIsEdgeHovered(true)}
          onMouseLeave={() => setIsEdgeHovered(false)}
          sx={{ position: 'absolute', top: 0, right: 0, width: 28, height: '100%', zIndex: 3 }}
        />

        <ButtonBase
          onClick={() => setIsCollapsed((currentValue) => !currentValue)}
          onMouseEnter={() => setIsToggleHovered(true)}
          onMouseLeave={() => setIsToggleHovered(false)}
          sx={{
            position: 'absolute',
            top: '50%',
            transform: `translate3d(${showToggleTab ? 0 : 5}px, -50%, 0)`,
            right: 4,
            width: 24,
            height: 54,
            borderRadius: `${theme.acomShape.buttonRadius}px`,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: '0 6px 20px rgba(22, 35, 66, 0.12)',
            zIndex: 4,
            opacity: showToggleTab ? 1 : 0,
            pointerEvents: showToggleTab ? 'auto' : 'none',
            transition: 'opacity 320ms cubic-bezier(0.22, 1, 0.36, 1), transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'opacity, transform'
          }}
        >
          {isCollapsed ? <NavigateNextRounded fontSize="small" /> : <NavigateBeforeRounded fontSize="small" />}
        </ButtonBase>
      </Stack>
    </Stack>
  );
};
