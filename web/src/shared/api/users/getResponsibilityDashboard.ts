import { fetchJson } from '../client';

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
  owner_full_name: string | null;
};

export type ResponsibilitySavingsItem = {
  request_id: number;
  owner_user_id: string;
  owner_full_name: string | null;
  initial_amount: number;
  offer_amount: number;
  final_amount: number;
  savings_amount: number;
  closed_at: string | null;
};

export type ResponsibilitySavingsSummary = {
  total_closed_requests: number;
  total_with_savings: number;
  total_savings_amount: number;
  items: ResponsibilitySavingsItem[];
};

export type ResponsibilityUpcomingUnavailability = {
  user_id: string;
  full_name: string | null;
  role_name: string;
  status: string;
  started_at: string;
  ended_at: string;
};

type ResponsibilityDashboardResponse = {
  data: {
    tree: ResponsibilityEmployeeNode[];
    unassigned_requests: ResponsibilityDashboardRequest[];
    my_requests: ResponsibilityDashboardRequest[];
    assigned_requests: ResponsibilityDashboardRequest[];
    active_unavailability: ResponsibilityUpcomingUnavailability[];
    upcoming_unavailability: ResponsibilityUpcomingUnavailability[];
    savings: ResponsibilitySavingsSummary;
  };
  _links?: {
    available_actions?: DashboardActionLink[];
    availableActions?: DashboardActionLink[];
  };
};

export type ResponsibilityDashboardResult = {
  tree: ResponsibilityEmployeeNode[];
  unassignedRequests: ResponsibilityDashboardRequest[];
  myRequests: ResponsibilityDashboardRequest[];
  assignedRequests: ResponsibilityDashboardRequest[];
  activeUnavailability: ResponsibilityUpcomingUnavailability[];
  upcomingUnavailability: ResponsibilityUpcomingUnavailability[];
  savings: ResponsibilitySavingsSummary;
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
    myRequests: response.data.my_requests,
    assignedRequests: response.data.assigned_requests,
    activeUnavailability: response.data.active_unavailability,
    upcomingUnavailability: response.data.upcoming_unavailability,
    savings: response.data.savings,
    availableActions: response._links?.available_actions ?? response._links?.availableActions ?? []
  };
};
