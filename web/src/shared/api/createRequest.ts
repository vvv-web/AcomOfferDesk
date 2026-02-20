import { apiFetch } from './client';

export type CreateRequestPayload = {
  description?: string | null;
  deadline_at: string;
  files: File[];
};

export type CreateRequestResponse = {
  data: {
    request_id: number;
    file_ids: number[];
  };
};

export const createRequest = async (payload: CreateRequestPayload): Promise<CreateRequestResponse> => {
  const formData = new FormData();
  formData.append('deadline_at', payload.deadline_at);

  
  if (payload.description) {
    formData.append('description', payload.description);
  }

  payload.files.forEach((file) => {
    formData.append('files', file, file.name);
  });

  const response = await apiFetch('/api/v1/requests', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.detail ?? 'Ошибка создания заявки';
    throw new Error(message);
  }

  return response.json();
};