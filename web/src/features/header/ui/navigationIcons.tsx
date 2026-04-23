import type { ReactNode } from 'react';
import AttachMoneyRounded from '@mui/icons-material/AttachMoneyRounded';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import FeedbackOutlined from '@mui/icons-material/FeedbackOutlined';
import FilePresentOutlinedIcon from '@mui/icons-material/FilePresentOutlined';
import GroupRounded from '@mui/icons-material/GroupRounded';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import ModeEditOutline from '@mui/icons-material/ModeEditOutline';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import SpaceDashboardRounded from '@mui/icons-material/SpaceDashboardRounded';

const iconByKey: Record<string, ReactNode> = {
  users: <PersonOutlineRounded fontSize="small" />,
  requests: <InsertDriveFileOutlined fontSize="small" />,
  feedback: <FeedbackOutlined fontSize="small" />,
  offers: <FilePresentOutlinedIcon fontSize="small" />,
  roles: <GroupRounded fontSize="small" />,
  contact: <ModeEditOutline fontSize="small" />,
  logout: <LogoutRounded fontSize="small" />,
  dashboard: <SpaceDashboardRounded fontSize="small" />,
  savings: <AttachMoneyRounded fontSize="small" />,
  plan: <DescriptionOutlined fontSize="small" />,
  employees: <GroupRounded fontSize="small" />,
  economists: <GroupRounded fontSize="small" />,
  contractors: <GroupRounded fontSize="small" />,
  admins: <PersonOutlineRounded fontSize="small" />,
  my: <FilePresentOutlinedIcon fontSize="small" />,
  open: <InsertDriveFileOutlined fontSize="small" />,
  more: <MoreHorizRounded fontSize="small" />,
  profile: <PersonOutlineRounded fontSize="small" />,
  guide: <HelpOutlineRounded fontSize="small" />,
  normative: <DescriptionOutlined fontSize="small" />,
  'dashboard-process': <SpaceDashboardRounded fontSize="small" />,
  'dashboard-savings': <AttachMoneyRounded fontSize="small" />,
  'dashboard-plan': <DescriptionOutlined fontSize="small" />,
};

export const getHeaderNavigationIcon = (key: string) => iconByKey[key] ?? <InsertDriveFileOutlined fontSize="small" />;
