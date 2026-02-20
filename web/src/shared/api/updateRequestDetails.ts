import { apiFetch, fetchEmpty, fetchJson } from './client';

export type RequestStatus = 'open' | 'review' | 'closed' | 'cancelled';

export type UpdateRequestDetailsPayload = {
  requestId: number;
  status?: RequestStatus;
  deadline_at?: string | null;
  owner_user_id?: string;
};

type UpdateRequestResponse = {
  data?: {
    item?: {
      request_id?: number;
      status?: string;
      deadline_at?: string | null;
      owner_user_id?: string;
    };
  };
};

export const updateRequestDetails = async (
  payload: UpdateRequestDetailsPayload
): Promise<UpdateRequestResponse> => {
  const body: Record<string, string | null> = {};

  if (payload.status !== undefined) {
    body.status = payload.status;
  }

  if (payload.deadline_at !== undefined) {
    body.deadline_at = payload.deadline_at;
  }

  if (payload.owner_user_id !== undefined) {
    body.owner_user_id = payload.owner_user_id;
  }

  return fetchJson<UpdateRequestResponse>(
    `/api/v1/requests/${payload.requestId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body)
    },
    'Ошибка сохранения заявки'
  );
};

export const deleteRequestFile = async (requestId: number, fileId: number) => {
  await fetchEmpty(
    `/api/v1/requests/${requestId}/files/${fileId}`,
    {
      method: 'DELETE'
    },
    'Ошибка удаления файла'
  );
};

  export const uploadRequestFile = async (requestId: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await apiFetch(`/api/v1/requests/${requestId}/files`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? 'Ошибка прикрепления файла');
  }

};
