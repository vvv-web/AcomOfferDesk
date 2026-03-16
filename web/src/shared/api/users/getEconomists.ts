import { fetchJson } from '../client';
import type { UserListItem } from './getUsers';
import { ROLE } from '@shared/constants/roles';

type UserActionLink = {
  href: string;
  method: string;
};

type EconomistRow = {
  user_id: string;
  status: string;
  full_name?: string | null;
  phone?: string | null;
  mail?: string | null;
};

type EconomistListResponse = {
  data: {
    items: EconomistRow[];
  };
  _links?: {
    available_actions?: UserActionLink[];
    availableActions?: UserActionLink[];
  };
};

export type GetEconomistsResult = {
  items: UserListItem[];
  availableActions: UserActionLink[];
};

export const getEconomists = async (): Promise<GetEconomistsResult> => {
  const response = await fetchJson<EconomistListResponse>(
    '/api/v1/users/economists',
    { method: 'GET' },
    'Ошибка загрузки экономистов'
  );

  const availableActions = response._links?.available_actions ?? response._links?.availableActions ?? [];

  return {
    items: response.data.items.map((item) => ({
      user_id: item.user_id,
      role_id: ROLE.ECONOMIST,
      status: item.status,
      full_name: item.full_name ?? null,
      phone: item.phone ?? null,
      mail: item.mail ?? null,
      tg_user_id: null,
      tg_status: null,
      company_name: null,
      inn: null,
      company_phone: null,
      company_mail: null,
      address: null,
      note: null
    })),
    availableActions
  };
};
