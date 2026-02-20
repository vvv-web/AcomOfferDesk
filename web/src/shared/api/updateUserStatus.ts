import { fetchJson } from './client';

type UpdateUserStatusPayload = {
  user_status: 'review' | 'active' | 'inactive' | 'blacklist';
  tg_status?: 'review' | 'approved' | 'disapproved';
};

type UpdateUserStatusResponse = {
  data: {
    user_id: string;
    user_status: string;
    tg_user_id: number | null;
    tg_status: string | null;
  };
};

export const updateUserStatus = async (
  userId: string,
  payload: UpdateUserStatusPayload
): Promise<UpdateUserStatusResponse> =>
  fetchJson<UpdateUserStatusResponse>(
    `/api/v1/users/${encodeURIComponent(userId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    },
    'Не удалось обновить статус пользователя'
  );
