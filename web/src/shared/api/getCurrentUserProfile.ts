import { fetchJson } from './client';

type UserActionLink = {
  href: string;
  method: string;
};

type ProfilePayload = {
  user_id?: string;
  id?: string;
  role_id?: number;
  id_role?: number;
  status?: string;
  full_name?: string | null;
  phone?: string | null;
  mail?: string | null;
  company_name?: string | null;
  inn?: string | null;
  company_phone?: string | null;
  phone_company?: string | null;
  company_mail?: string | null;
  mail_company?: string | null;
  address?: string | null;
  note?: string | null;
  users?: {
    id?: string;
    user_id?: string;
    role_id?: number;
    id_role?: number;
    status?: string;
  };
  profiles?: {
    full_name?: string | null;
    phone?: string | null;
    mail?: string | null;
  };
  company_contacts?: {
    company_name?: string | null;
    inn?: string | null;
    phone?: string | null;
    mail?: string | null;
    address?: string | null;
    note?: string | null;
  };
};

type LinkContainer = {
  available_actions?: UserActionLink[];
  available_action?: UserActionLink[];
  availableActions?: UserActionLink[];
};

type CurrentUserResponse = {
  data?: ProfilePayload;
  _links?: LinkContainer;
  links?: LinkContainer;
};

export type CurrentUserProfile = {
  userId: string;
  roleId: number;
  status: string;
  fullName: string | null;
  phone: string | null;
  mail: string | null;
  company: {
    companyName: string | null;
    inn: string | null;
    phone: string | null;
    mail: string | null;
    address: string | null;
    note: string | null;
  };
  availableActions: UserActionLink[];
};

type UpdateCredentialsPayload = {
  current_password: string;
  new_password: string;
};

type UpdateProfilePayload = {
  full_name?: string;
  phone?: string;
  mail?: string;
};

type UpdateCompanyContactsPayload = {
  company_name?: string;
  inn?: string;
  company_phone?: string;
  company_mail?: string;
  address?: string;
  note?: string;
};

const mapCurrentUserProfile = (response: CurrentUserResponse): CurrentUserProfile => {
  const data = response.data ?? {};
  const users = data.users;
  const profiles = data.profiles;
  const companyContacts = data.company_contacts;
  const links = response._links ?? response.links;

  return {
    userId: data.user_id ?? data.id ?? users?.user_id ?? users?.id ?? '',
    roleId: data.role_id ?? data.id_role ?? users?.role_id ?? users?.id_role ?? 0,
    status: data.status ?? users?.status ?? 'review',
    fullName: data.full_name ?? profiles?.full_name ?? null,
    phone: data.phone ?? profiles?.phone ?? null,
    mail: data.mail ?? profiles?.mail ?? null,
    company: {
      companyName: data.company_name ?? companyContacts?.company_name ?? null,
      inn: data.inn ?? companyContacts?.inn ?? null,
      phone: data.company_phone ?? data.phone_company ?? companyContacts?.phone ?? null,
      mail: data.company_mail ?? data.mail_company ?? companyContacts?.mail ?? null,
      address: data.address ?? companyContacts?.address ?? null,
      note: data.note ?? companyContacts?.note ?? null
    },
    availableActions: links?.available_actions ?? links?.available_action ?? links?.availableActions ?? []
  };
};

export const getCurrentUserProfile = async (): Promise<CurrentUserProfile> => {
  const response = await fetchJson<CurrentUserResponse>(
    '/api/v1/users/me',
    { method: 'GET' },
    'Ошибка загрузки профиля пользователя'
  );

  return mapCurrentUserProfile(response);
};

export const updateMyCredentials = async (payload: UpdateCredentialsPayload): Promise<CurrentUserProfile> => {
  const response = await fetchJson<CurrentUserResponse>(
    '/api/v1/users/me/credentials',
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Ошибка обновления пароля'
  );

  return mapCurrentUserProfile(response);
};

export const updateMyProfile = async (payload: UpdateProfilePayload): Promise<CurrentUserProfile> => {
  const response = await fetchJson<CurrentUserResponse>(
    '/api/v1/users/me/profile',
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Ошибка обновления личных данных'
  );

  return mapCurrentUserProfile(response);
};

export const updateMyCompanyContacts = async (payload: UpdateCompanyContactsPayload): Promise<CurrentUserProfile> => {
  const response = await fetchJson<CurrentUserResponse>(
    '/api/v1/users/me/company-contacts',
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Ошибка обновления данных компании'
  );

  return mapCurrentUserProfile(response);
};
