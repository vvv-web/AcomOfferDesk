import { fetchJson } from './client';

type DashboardActionLink = {
  href: string;
  method: string;
};

export type ResponsibilityStatusCounter = {
  status: string;
  status_label: string;
  count: number;
};

export type ResponsibilityEmployeeNode = {
  user_id: string;
  full_name: string | null;
  role_id: number;
  role_name: string;
  parent_user_id: string | null;
  in_progress_total: number;
  statuses: ResponsibilityStatusCounter[];
  children: ResponsibilityEmployeeNode[];
};

export type ResponsibilityDashboardRequest  = {
  request_id: number;
  description: string | null;
  status: string;
  status_label: string;
  deadline_at: string;
  created_at: string;
  updated_at: string;
  owner_user_id: string;
};

type ResponsibilityDashboardResponse = {
  data: {
    tree: ResponsibilityEmployeeNode[];
    unassigned_requests: ResponsibilityDashboardRequest[];
    assigned_requests: ResponsibilityDashboardRequest[];
  };
  _links?: {
    available_actions?: DashboardActionLink[];
    availableActions?: DashboardActionLink[];
  };
};

export type ResponsibilityDashboardResult = {
  tree: ResponsibilityEmployeeNode[];
  unassignedRequests: ResponsibilityDashboardRequest[];
  assignedRequests: ResponsibilityDashboardRequest[];
  availableActions: DashboardActionLink[];
};

export const getResponsibilityDashboard = async (): Promise<ResponsibilityDashboardResult> => {
  const response = await fetchJson<ResponsibilityDashboardResponse>(
    '/api/v1/dashboard/responsibility',
    { method: 'GET' },
    'Ошибка загрузки дашборда распределения заявок'
  );

  return {
    tree: response.data.tree,
    unassignedRequests: response.data.unassigned_requests,
    assignedRequests: response.data.assigned_requests,
    availableActions: response._links?.available_actions ?? response._links?.availableActions ?? []
  };
};