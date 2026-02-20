import { fetchEmpty, fetchJson } from './client';
import type { AuthLink } from './loginWebUser';
import { resolveAvailableActions } from './mappers';
import type { FileEntity, OfferMessageEntity } from '@shared/types/domain';

export type OfferMessageAttachment = Pick<FileEntity, 'id' | 'name' | 'download_url'>;

export type OfferWorkspaceMessage = OfferMessageEntity & {
  attachments: OfferMessageAttachment[];
};

export type OfferMessagesResult = {
  offerId: number;
  items: OfferWorkspaceMessage[];
  availableActions: AuthLink[];
};

type MessagesResponse = {
  data: {
    offer_id: number;
    items: Array<OfferWorkspaceMessage & { attachments?: OfferMessageAttachment[] }>;
  };
  _links?: {
    available_action?: AuthLink[];
    available_actions?: AuthLink[];
    availableActions?: AuthLink[];
  };
};

type OfferMessageCreateResponse = {
  data: {
    offer_id: number;
    message_id: number;
  };
};

type UploadResponse = {
  data: {
    offer_id: number;
    file_id: number;
  };
};

type MessageStatusPayload = {
  message_ids: number[];
};

type MessageStatusResponse = {
  data: {
    offer_id: number;
    updated_count: number;
  };
};

export const getOfferMessages = async (offerId: number): Promise<OfferMessagesResult> => {
  const response = await fetchJson<MessagesResponse>(
    `/api/v1/offers/${offerId}/messages`,
    { method: 'GET' },
    'Ошибка загрузки сообщений'
  );

  return {
    offerId: response.data.offer_id,
    items: (response.data.items ?? []).map((message) => ({
      ...message,
      attachments: message.attachments ?? []
    })),
    availableActions: resolveAvailableActions(response)
  };
};

export const sendOfferMessage = async (offerId: number, text: string): Promise<OfferMessageCreateResponse['data']> => {
  const response = await fetchJson<OfferMessageCreateResponse>(
    `/api/v1/offers/${offerId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ text })
    },
    'Не удалось отправить сообщение'
  );

  return response.data;
};

export const sendOfferMessageWithAttachments = async (offerId: number, text: string, files: File[]) => {
  const formData = new FormData();
  formData.set('text', text);
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetchJson<OfferMessageCreateResponse>(
    `/api/v1/offers/${offerId}/messages/attachments`,
    {
      method: 'POST',
      body: formData
    },
    'Не удалось отправить сообщение с вложениями'
  );

  return response.data;
};

export const markOfferMessagesReceived = async (offerId: number, messageIds: number[]) => {
  if (!messageIds.length) {
    return;
  }

  await fetchJson<MessageStatusResponse>(
    `/api/v1/offers/${offerId}/messages/received`,
    {
      method: 'PATCH',
      body: JSON.stringify({ message_ids: messageIds } satisfies MessageStatusPayload)
    },
    'Не удалось обновить статус доставки сообщений'
  );
};

export const markOfferMessagesRead = async (offerId: number, messageIds: number[]) => {
  if (!messageIds.length) {
    return;
  }

  await fetchJson<MessageStatusResponse>(
    `/api/v1/offers/${offerId}/messages/read`,
    {
      method: 'PATCH',
      body: JSON.stringify({ message_ids: messageIds } satisfies MessageStatusPayload)
    },
    'Не удалось обновить статус прочтения сообщений'
  );
};

export const uploadOfferFile = async (offerId: number, file: File) => {
  const formData = new FormData();
  formData.set('file', file);

  const response = await fetchJson<UploadResponse>(
    `/api/v1/offers/${offerId}/files`,
    {
      method: 'POST',
      body: formData
    },
    'Не удалось загрузить файл'
  );

  return response.data;
};

export const deleteOfferFile = async (offerId: number, fileId: number) => {
  await fetchEmpty(
    `/api/v1/offers/${offerId}/files/${fileId}`,
    { method: 'DELETE' },
    'Не удалось удалить файл'
  );
};
