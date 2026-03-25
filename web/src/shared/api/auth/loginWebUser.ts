import { fetchEmpty, fetchJson } from '../client';

export type LoginWebUserPayload = {
  login: string;
  password: string;
};

export type TgExchangePayload = {
  token: string;
};

export type AuthLink = {
  href: string;
  method: string;
};

export type AuthSessionResponse = {
  data: {
    access_token: string;
    token_type: string;
    access_token_expires_at: number;
    user_id: string;
    login: string;
    role_id: number;
    status: string;
    permissions?: string[];
  };
  _links?: {
    self: AuthLink;
  };
};

export const loginWebUser = async (payload: LoginWebUserPayload): Promise<AuthSessionResponse> =>
  fetchJson<AuthSessionResponse>(
    '/api/v1/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    'Ошибка авторизации',
    false
  );

export const refreshWebSession = async (): Promise<AuthSessionResponse> =>
  fetchJson<AuthSessionResponse>(
    '/api/v1/auth/refresh',
    {
      method: 'POST'
    },
    'Не удалось восстановить сессию',
    false
  );

export const logoutWebSession = async (): Promise<void> =>
  fetchEmpty(
    '/api/v1/auth/logout',
    {
      method: 'POST'
    },
    'Не удалось завершить сессию',
    false
  );

export const exchangeTgSession = async (payload: TgExchangePayload): Promise<AuthSessionResponse> =>
  fetchJson<AuthSessionResponse>(
    '/api/v1/auth/tg/exchange',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    'Ошибка авторизации через Telegram',
    false
  );
