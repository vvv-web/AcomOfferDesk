import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import KeyboardDoubleArrowLeftRounded from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import KeyboardDoubleArrowRightRounded from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import ModeEditOutline from '@mui/icons-material/ModeEditOutline';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import SentimentSatisfiedAltRounded from '@mui/icons-material/SentimentSatisfiedAltRounded';
import { IconButton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
      feedback: <SentimentSatisfiedAltRounded fontSize="small" />,
      offers: <InsertDriveFileOutlined fontSize="small" />,
      roles: <PersonOutlineRounded fontSize="small" />,
      contact: <ModeEditOutline fontSize="small" />,
      logout: <LogoutRounded fontSize="small" />,
    }),
    []
  );

  const topItems = (config.sidebarItems ?? []).filter((item) => !item.isBottomItem && item.key !== 'logout');
  const bottomItems = (config.sidebarItems ?? []).filter((item) => item.isBottomItem || item.key === 'logout');

  return (
    <Stack
      component="aside"
      justifyContent="space-between"
      sx={{
        width: '100%',
        position: 'relative',
        minHeight: { xs: 'auto', lg: '100vh' },
        height: { xs: 'auto', lg: '100vh' },
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
          {!collapsed ? (
            <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
              AcomOfferDesk
            </Typography>
          ) : null}
        </Stack>

        <Stack spacing={1.25} sx={{ overflowY: { lg: 'auto' }, pr: { lg: 0.5 } }}>
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
          {bottomItems.map((item) => {
            const icon = item.icon ?? iconByKey[item.key as keyof typeof iconByKey];
            if (item.key === 'logout') {
              return (
                <SidebarMenuButton
                  key={item.key}
                  label={item.label}
                  icon={icon}
                  collapsed={collapsed}
                  onClick={onLogout}
                />
              );
            }

            if (item.to) {
              return (
                <SidebarMenuButton
                  key={item.key}
                  label={item.label}
                  icon={icon}
                  collapsed={collapsed}
                  onClick={() => item.to && navigate(item.to)}
                  disabled={item.disabled}
                />
              );
            }

            return (
              <SidebarMenuButton
                key={item.key}
                label={item.label}
                icon={icon}
                collapsed={collapsed}
                disabled={item.disabled}
              />
            );
          })}
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
              {collapsed ? <KeyboardDoubleArrowRightRounded fontSize="small" /> : <KeyboardDoubleArrowLeftRounded fontSize="small" />}
            </IconButton>
          </>
        ) : null}
      </Stack>
    </Stack>
  );
};
