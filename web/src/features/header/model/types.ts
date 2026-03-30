export type HeaderMode = 'hidden' | 'topbar' | 'sidebar';

export type HeaderTab = {
  key: string;
  label: string;
  value: string;
};

export type HeaderAction = {
  key: string;
  label: string;
  variant: 'contained' | 'outlined';
  onClick: () => void;
};

export type HeaderBackAction = {
  label: string;
  onClick: () => void;
};

export type HeaderSidebarItem = {
  key: string;
  label: string;
  to?: string;
  disabled?: boolean;
};

export type HeaderConfig = {
  mode: HeaderMode;
  title?: string;
  tabs: HeaderTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  actions: HeaderAction[];
  backAction?: HeaderBackAction;
  sidebarItems?: HeaderSidebarItem[];
  showFeedback: boolean;
  showRoleGuide: boolean;
  showProfile: boolean;
  showLogout: boolean;
};
