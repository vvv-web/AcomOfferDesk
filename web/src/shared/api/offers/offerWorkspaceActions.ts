import { fetchEmpty, fetchJson } from '../client';
import type { AuthLink } from '../auth/loginWebUser';
import { resolveAvailableActions } from '../mappers';
import type { OfferMessageEntity } from '@entities/offer';
import type { FileEntity } from '@entities/request';

export type OfferMessageAttachment = Pick<FileEntity, 'id' | 'name' | 'download_url'>;

export type OfferWorkspaceMessage = OfferMessageEntity & {
  offer_id: number;
  is_system?: boolean;
  is_muted?: boolean;
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

type UpdateOfferAmountResponse = {
  data: {
    offer_id: number;
    offer_amount: number;
  };
};

type MessageFileUploadResponse = {
  data: {
    offer_id: number;
    file_id: number;
    name: string;
    path: string;
    upload_token: string;
    download_url: string;
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
    'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё СЃРѕРѕР±С‰РµРЅРёР№'
  );

  return {
    offerId: response.data.offer_id,
    items: (response.data.items ?? []).map((message) => ({
      ...message,
      offer_id: response.data.offer_id,
      read_by: message.read_by ?? [],
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
    'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ'
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
    'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ СЃ РІР»РѕР¶РµРЅРёСЏРјРё'
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
    'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ РґРѕСЃС‚Р°РІРєРё СЃРѕРѕР±С‰РµРЅРёР№'
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
    'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ РїСЂРѕС‡С‚РµРЅРёСЏ СЃРѕРѕР±С‰РµРЅРёР№'
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
    'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ С„Р°Р№Р»'
  );

  return response.data;
};

export const uploadOfferMessageFile = async (offerId: number, file: File) => {
  const formData = new FormData();
  formData.set('file', file);

  const response = await fetchJson<MessageFileUploadResponse>(
    `/api/v1/offers/${offerId}/messages/files`,
    {
      method: 'POST',
      body: formData
    },
    'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РІР»РѕР¶РµРЅРёРµ РґР»СЏ СЃРѕРѕР±С‰РµРЅРёСЏ'
  );

  return response.data;
};

export const deleteOfferFile = async (offerId: number, fileId: number) => {
  await fetchEmpty(
    `/api/v1/offers/${offerId}/files/${fileId}`,
    { method: 'DELETE' },
    'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ С„Р°Р№Р»'
  );
};

export const updateOfferAmount = async (offerId: number, offerAmount: number) => {
  const response = await fetchJson<UpdateOfferAmountResponse>(
    `/api/v1/offers/${offerId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ offer_amount: offerAmount })
    },
    'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ СЃСѓРјРјСѓ РѕС„С„РµСЂР°'
  );

  return response.data;
};
