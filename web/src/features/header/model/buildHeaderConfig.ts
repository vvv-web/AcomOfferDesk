import type { HeaderConfig, HeaderSidebarItem } from './types';
import { ROLE } from '@shared/constants/roles';

type BuildHeaderConfigArgs = {
  roleId: number | null;
  pathname: string;
  canCreateRequest: boolean;
  canRegisterUser: boolean;
  canLoadOpenRequests: boolean;
  canLoadOfferedRequests: boolean;
  canOpenUsersPage: boolean;
  contractorTab: 'my' | 'open';
  adminUsersTab: 'contractors' | 'economists' | 'admins';
  onNavigateToDashboard: () => void;
  onNavigateToRequests: () => void;
  onNavigateToRequestCreate: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToAdminCreate: () => void;
  onNavigateBackToRequests: () => void;
  onSetContractorTab: (value: 'my' | 'open') => void;
  onSetAdminUsersTab: (value: 'contractors' | 'economists' | 'admins') => void;
};

const superadminItems: HeaderSidebarItem[] = [
  { key: 'users', label: 'Пользователи', to: '/admin' },
  { key: 'requests', label: 'Заявки', to: '/requests' },
  { key: 'feedback', label: 'Фидбек', to: '/feedback' },
  { key: 'offers', label: 'КП', disabled: true },
  { key: 'roles', label: 'Роли', disabled: true }
];

export const buildHeaderConfig = ({
  roleId,
  pathname,
  canCreateRequest,
  canRegisterUser,
  canLoadOpenRequests,
  canLoadOfferedRequests,
  canOpenUsersPage,
  contractorTab,
  adminUsersTab,
  onNavigateToDashboard,
  onNavigateToRequests,
  onNavigateToRequestCreate,
  onNavigateToAdmin,
  onNavigateToAdminCreate,
  onNavigateBackToRequests,
  onSetContractorTab,
  onSetAdminUsersTab
}: BuildHeaderConfigArgs): HeaderConfig => {
  const isSuperadmin = roleId === ROLE.SUPERADMIN;
  const isAdmin = roleId === ROLE.ADMIN;
  const isContractor = roleId === ROLE.CONTRACTOR;
  const isLeadEconomist = roleId === ROLE.LEAD_ECONOMIST;
  const isProjectManager = roleId === ROLE.PROJECT_MANAGER;
  const isEconomist = roleId === ROLE.ECONOMIST;
  const isLeadLike = isLeadEconomist || isProjectManager || isEconomist;

  const isRequestsListPage = pathname === '/requests';
  const isRequestDetailsPage = /^\/requests\/\d+$/.test(pathname);
  const isOfferWorkspacePage = /^\/offers\/\d+\/workspace$/.test(pathname);
  const isResponsibilityDashboard = (isProjectManager || isLeadEconomist) && pathname === '/pm-dashboard';
  const isResponsibilityRequestsPage = (isProjectManager || isLeadEconomist) && pathname.startsWith('/requests');
  const isResponsibilityEmployeesPage = (isProjectManager || isLeadEconomist) && pathname.startsWith('/admin');
  const isAdminUsersPage = isAdmin && pathname.startsWith('/admin');

  const canUseContractorTabs = isContractor && isRequestsListPage && canLoadOpenRequests && canLoadOfferedRequests;
  const isLeadRequestsTab = isLeadLike && pathname.startsWith('/requests');
  const isLeadEconomistsTab = isLeadLike && pathname.startsWith('/admin');
  const canUseLeadTabs = isLeadLike && !isProjectManager && !isLeadEconomist
    && (isLeadRequestsTab || isLeadEconomistsTab)
    && (canOpenUsersPage || isEconomist);
  const canUseProjectManagerTabs = (isProjectManager || isLeadEconomist)
    && (isResponsibilityDashboard || isResponsibilityRequestsPage || isResponsibilityEmployeesPage)
    && canOpenUsersPage;

  if (isOfferWorkspacePage) {
    return {
      mode: 'hidden',
      tabs: [],
      actions: [],
      showFeedback: false,
      showRoleGuide: false,
      showProfile: false,
      showLogout: false
    };
  }

  if (isSuperadmin) {
    return {
      mode: 'sidebar',
      tabs: [],
      actions: isRequestsListPage && canCreateRequest
        ? [{
            key: 'create-request',
            label: 'Создать заявку',
            variant: 'contained',
            onClick: onNavigateToRequestCreate
          }]
        : [],
      sidebarItems: superadminItems,
      showFeedback: true,
      showRoleGuide: true,
      showProfile: false,
      showLogout: true
    };
  }

  if (canUseProjectManagerTabs) {
    return {
      mode: 'topbar',
      title: isResponsibilityDashboard
        ? isProjectManager
          ? 'Дашборд Руководителя проекта'
          : 'Дашборд Ведущего экономиста'
        : undefined,
      tabs: [
        { key: 'dashboard', value: 'dashboard', label: 'Дашборд' },
        { key: 'requests', value: 'requests', label: 'Заявки' },
        { key: 'employees', value: 'employees', label: 'Сотрудники' }
      ],
      activeTab: isResponsibilityDashboard ? 'dashboard' : isResponsibilityEmployeesPage ? 'employees' : 'requests',
      onTabChange: (value) => {
        if (value === 'dashboard') {
          onNavigateToDashboard();
          return;
        }
        if (value === 'employees') {
          onNavigateToAdmin();
          return;
        }
        onNavigateToRequests();
      },
      actions: [
        ...(isResponsibilityRequestsPage && canCreateRequest
          ? [{
              key: 'create-request',
              label: 'Создать заявку',
              variant: 'outlined' as const,
              onClick: onNavigateToRequestCreate
            }]
          : []),
        ...(isResponsibilityEmployeesPage && canRegisterUser
          ? [{
              key: 'create-economist',
              label: 'Добавить экономиста',
              variant: 'outlined' as const,
              onClick: onNavigateToAdminCreate
            }]
          : [])
      ],
      showFeedback: true,
      showRoleGuide: true,
      showProfile: true,
      showLogout: true
    };
  }

  if (isRequestDetailsPage) {
    return {
      mode: 'topbar',
      tabs: [],
      actions: [],
      backAction: {
        label: 'К списку заявок',
        onClick: onNavigateBackToRequests
      },
      showFeedback: true,
      showRoleGuide: true,
      showProfile: true,
      showLogout: true
    };
  }

  if (canUseContractorTabs) {
    return {
      mode: 'topbar',
      tabs: [
        { key: 'my', value: 'my', label: 'Мои заявки' },
        { key: 'open', value: 'open', label: 'Актуальные заявки' }
      ],
      activeTab: contractorTab,
      onTabChange: (value) => onSetContractorTab(value as 'my' | 'open'),
      actions: [],
      showFeedback: true,
      showRoleGuide: true,
      showProfile: true,
      showLogout: true
    };
  }

  if (canUseLeadTabs) {
    return {
      mode: 'topbar',
      tabs: [
        { key: 'requests', value: 'requests', label: 'Заявки' },
        { key: 'economists', value: 'economists', label: 'Экономисты' }
      ],
      activeTab: pathname === '/admin' ? 'economists' : 'requests',
      onTabChange: (value) => {
        if (value === 'economists') {
          onNavigateToAdmin();
          return;
        }
        onNavigateToRequests();
      },
      actions: (isLeadRequestsTab ? canCreateRequest : canRegisterUser)
        ? [{
            key: 'lead-context-action',
            label: isLeadRequestsTab ? 'Создать заявку' : 'Добавить экономиста',
            variant: 'outlined',
            onClick: isLeadRequestsTab ? onNavigateToRequestCreate : onNavigateToAdminCreate
          }]
        : [],
      showFeedback: true,
      showRoleGuide: true,
      showProfile: true,
      showLogout: true
    };
  }

  if (isAdminUsersPage) {
    return {
      mode: 'topbar',
      tabs: [
        { key: 'contractors', value: 'contractors', label: 'Контрагенты' },
        { key: 'economists', value: 'economists', label: 'Экономисты' },
        { key: 'admins', value: 'admins', label: 'Администраторы' }
      ],
      activeTab: adminUsersTab,
      onTabChange: (value) => onSetAdminUsersTab(value as 'contractors' | 'economists' | 'admins'),
      actions: canRegisterUser
        ? [{
            key: 'create-user',
            label: 'Добавить пользователя',
            variant: 'outlined',
            onClick: onNavigateToAdminCreate
          }]
        : [],
      showFeedback: true,
      showRoleGuide: true,
      showProfile: true,
      showLogout: true
    };
  }

  return {
    mode: 'topbar',
    tabs: [],
    actions: isRequestsListPage && canCreateRequest
      ? [{
          key: 'create-request',
          label: 'Создать заявку',
          variant: 'contained',
          onClick: onNavigateToRequestCreate
        }]
      : [],
    showFeedback: true,
    showRoleGuide: true,
    showProfile: true,
    showLogout: true
  };
};
