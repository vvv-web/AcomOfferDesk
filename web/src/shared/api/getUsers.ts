import { fetchJson } from './client';

type UserActionLink = {
  href: string;
  method: string;
};

type UsersRow = {
  id?: string;
  user_id?: string;
  id_role?: number;
  role_id?: number;
  status?: string;
  tg_user_id?: number | null;
  full_name?: string | null;
  phone?: string | null;
  mail?: string | null;
  company_name?: string | null;
  inn?: string | null;
  company_phone?: string | null;
  company_mail?: string | null;
  address?: string | null;
  note?: string | null;
  tg_status?: string | null;
  users?: {
    id?: string;
    id_role?: number;
    role_id?: number;
    status?: string;
    tg_user_id?: number | null;
  };
  profiles?: {
    id?: string;
    full_name?: string | null;
    phone?: string | null;
    mail?: string | null;
  };
  company_contacts?: {
    id?: string;
    company_name?: string | null;
    inn?: string | null;
    phone?: string | null;
    mail?: string | null;
    address?: string | null;
    note?: string | null;
  };
  tg_users?: {
    id?: number;
    status?: string | null;
  };
};


export type UserListItem = {
  user_id: string;
  role_id: number;
  status: string;
  full_name: string | null;
  phone: string | null;
  mail: string | null;
  tg_user_id: number | null;
  tg_status: string | null;
  company_name: string | null;
  inn: string | null;
  company_phone: string | null;
  company_mail: string | null;
  address: string | null;
  note: string | null;
};

type UserListResponse = {
  data: {
    items: UsersRow[];
  };
  _links?: {
    available_actions?: UserActionLink[];
    availableActions?: UserActionLink[];
  };
};

export type GetUsersResult = {
  items: UserListItem[];
  availableActions: UserActionLink[];
};

const normalizeUserItem = (item: UsersRow): UserListItem => {
  const users = item.users;
  const profile = item.profiles;
  const company = item.company_contacts;
  const tgUser = item.tg_users;

  const userId = item.user_id ?? users?.id ?? item.id ?? profile?.id ?? company?.id ?? '';
  const roleId = item.role_id ?? users?.role_id ?? item.id_role ?? users?.id_role ?? 0;
  const companyPhone = item.company_phone ?? company?.phone ?? null;
  const companyMail = item.company_mail ?? company?.mail ?? null;

  return {
    user_id: userId,
    role_id: roleId,
    status: item.status ?? users?.status ?? 'review',
    full_name: item.full_name ?? profile?.full_name ?? null,
    phone: item.phone ?? profile?.phone ?? null,
    mail: item.mail ?? profile?.mail ?? null,
    tg_user_id: item.tg_user_id ?? users?.tg_user_id ?? tgUser?.id ?? null,
    tg_status: item.tg_status ?? tgUser?.status ?? null,
    company_name: item.company_name ?? company?.company_name ?? null,
    inn: item.inn ?? company?.inn ?? null,
    company_phone: companyPhone,
    company_mail: companyMail,
    address: item.address ?? company?.address ?? null,
    note: item.note ?? company?.note ?? null
  };
};

export const getUsers = async (roleId?: number): Promise<GetUsersResult> => {
  const search = typeof roleId === 'number' ? `?role_id=${roleId}` : '';
  const response = await fetchJson<UserListResponse>(
    `/api/v1/users${search}`,
    { method: 'GET' },
    'Ошибка загрузки пользователей'
  );

  const availableActions = response._links?.available_actions ?? response._links?.availableActions ?? [];

  return {
    items: response.data.items.map(normalizeUserItem),
    availableActions
  };
};