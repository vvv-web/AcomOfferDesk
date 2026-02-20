import { fetchJson } from './client';

export type CompleteTgRegistrationPayload = {
  token: string;
  login: string;
  password: string;
  password_confirm: string;
  full_name: string;
  phone: string;
  mail: string;
  company_name: string;
  inn: string;
  company_phone: string;
  company_mail: string;
  address: string;
  note: string;
};

export type CompleteTgRegistrationResponse = {
  data: {
    user_id: string;
    status: string;
    tg_user_id: number;
  };
  _links: {
    self: { href: string; method: string };
    available_action?: { href: string; method: string };
  };
};

export const completeTgRegistration = async (
  payload: CompleteTgRegistrationPayload
): Promise<CompleteTgRegistrationResponse> => {
  return fetchJson<CompleteTgRegistrationResponse>(
    '/api/v1/tg/register/complete/',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    'Ошибка регистрации',
    false
  );
};
