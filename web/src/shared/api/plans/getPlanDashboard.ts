import { fetchJson } from '../client';
import type { PlanDashboardResult } from './types';

type PlanDashboardResponse = {
  data: PlanDashboardResult;
};

export const getPlanDashboard = async (period: string): Promise<PlanDashboardResult> => {
  const response = await fetchJson<PlanDashboardResponse>(
    `/api/v1/plans?period=${encodeURIComponent(period)}`,
    { method: 'GET' },
    'Не удалось загрузить вкладку плана'
  );
  return response.data;
};
