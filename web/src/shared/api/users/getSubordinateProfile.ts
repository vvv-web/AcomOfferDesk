import { fetchJson } from '../client';

type ActionLink = { href: string; method: string };

type SubordinatePayload = {
  user_id: string;
  role_id: number;
  status: string;
  full_name?: string | null;
  phone?: string | null;
  mail?: string | null;
  unavailable_period?: {
    id: number;
    status: string;
    started_at: string;
    ended_at: string;
  } | null;
  unavailable_periods?: Array<{
    id: number;
    status: string;
    started_at: string;
    ended_at: string;
  }>;
};

type LinkContainer = {
  available_actions?: ActionLink[];
  availableActions?: ActionLink[];
  available_action?: ActionLink[];
};

type SubordinateResponse = {
  data: SubordinatePayload;
  _links?: LinkContainer;
  links?: LinkContainer;
};

export type SubordinateProfile = {
  userId: string;
  roleId: number;
  status: string;
  fullName: string | null;
  phone: string | null;
  mail: string | null;
  unavailablePeriod: {
    id: number;
    status: string;
    startedAt: string;
    endedAt: string;
  } | null;
  unavailablePeriods: Array<{
    id: number;
    status: string;
    startedAt: string;
    endedAt: string;
  }>;
  availableActions: ActionLink[];
};

type SetSubordinateUnavailabilityPayload = {
  status: string;
  started_at: string;
  ended_at: string;
};

const mapSubordinateProfile = (response: SubordinateResponse): SubordinateProfile => {
  const links = response._links ?? response.links;

  return ({
  userId: response.data.user_id,
  roleId: response.data.role_id,
  status: response.data.status,
  fullName: response.data.full_name ?? null,
  phone: response.data.phone ?? null,
  mail: response.data.mail ?? null,
  unavailablePeriod: response.data.unavailable_period
    ? {
        id: response.data.unavailable_period.id,
        status: response.data.unavailable_period.status,
        startedAt: response.data.unavailable_period.started_at,
        endedAt: response.data.unavailable_period.ended_at
      }
    : null,
  unavailablePeriods: (response.data.unavailable_periods ?? []).map((period) => ({
    id: period.id,
    status: period.status,
    startedAt: period.started_at,
    endedAt: period.ended_at
  })),
  availableActions: links?.available_actions ?? links?.availableActions ?? links?.available_action ?? []
  });
};

export const getSubordinateProfile = async (userId: string): Promise<SubordinateProfile> => {
  const response = await fetchJson<SubordinateResponse>(
    `/api/v1/users/${userId}/profile`,
    { method: 'GET' },
    'Ошибка загрузки профиля подчиненного'
  );

  return mapSubordinateProfile(response);
};

export const setSubordinateUnavailabilityPeriod = async (
  userId: string,
  payload: SetSubordinateUnavailabilityPayload
): Promise<SubordinateProfile> => {
  const response = await fetchJson<SubordinateResponse>(
    `/api/v1/users/${userId}/unavailability-period`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Ошибка обновления нерабочего статуса подчиненного'
  );

  return mapSubordinateProfile(response);
};
