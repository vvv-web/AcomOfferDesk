import { useCallback, useState } from 'react';
import {
  getOfferMessages,
  markOfferMessagesRead,
  markOfferMessagesReceived,
  sendOfferMessage,
  sendOfferMessageWithAttachments
} from '@shared/api/offers/offerWorkspaceActions';
import type { OfferWorkspaceMessage } from '@shared/api/offers/offerWorkspaceActions';
import { hasAvailableAction } from '@shared/auth/availableActions';
import type { AuthLink } from '@shared/api/auth/loginWebUser';
import { getErrorMessage } from '@shared/lib/errors';

export const buildUnifiedChat = async (offers: Array<{ offer_id: number; status: string; created_at: string | null; updated_at: string | null }>) => {
  const sortedByCreated = [...offers].sort(
    (left, right) => new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime()
  );
  const merged: OfferWorkspaceMessage[] = [];

  for (let idx = 0; idx < sortedByCreated.length; idx += 1) {
    const offer = sortedByCreated[idx];
    const response = await getOfferMessages(offer.offer_id);
    merged.push(
      ...response.items.map((message) => ({ ...message, offer_id: offer.offer_id, is_muted: offer.status === 'deleted' }))
    );

    if (offer.status === 'deleted') {
      merged.push({
        id: -1000000 - offer.offer_id,
        offer_id: offer.offer_id,
        user_id: 'system',
        user_full_name: 'Система',
        text: `Оффер №${offer.offer_id} был удален.`,
        status: 'read',
        created_at: offer.updated_at ?? offer.created_at ?? new Date().toISOString(),
        updated_at: offer.updated_at ?? offer.created_at ?? new Date().toISOString(),
        attachments: [],
        is_system: true,
        is_muted: true
      });
      const nextOffer = sortedByCreated[idx + 1];
      if (nextOffer) {
        merged.push({
          id: -2000000 - nextOffer.offer_id,
          offer_id: nextOffer.offer_id,
          user_id: 'system',
          user_full_name: 'Система',
          text: `Создан новый оффер №${nextOffer.offer_id}.`,
          status: 'read',
          created_at: nextOffer.created_at ?? new Date().toISOString(),
          updated_at: nextOffer.created_at ?? new Date().toISOString(),
          attachments: [],
          is_system: true,
          is_muted: false
        });
      }
    }
  }

  return merged.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
};

export const useOfferMessages = (sessionLogin?: string) => {
  const [messages, setMessages] = useState<OfferWorkspaceMessage[]>([]);
  const [chatActions, setChatActions] = useState<AuthLink[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [chatErrorMessage, setChatErrorMessage] = useState<string | null>(null);

  const loadMessages = useCallback(async (offerId: number, offerItems: any[], syncStatuses = true) => {
    const messagesResponse = await getOfferMessages(offerId);
    setMessages(await buildUnifiedChat(offerItems));
    setChatActions(messagesResponse.availableActions);

    if (!syncStatuses || !sessionLogin) {
      return;
    }

    const canSetReceived = hasAvailableAction(
      { availableActions: messagesResponse.availableActions },
      `/api/v1/offers/${offerId}/messages/received`,
      'PATCH'
    );

    const incomingSendIds = messagesResponse.items.filter((item) => item.user_id !== sessionLogin && item.status === 'send').map((item) => item.id);
    if (canSetReceived && incomingSendIds.length > 0) {
      await markOfferMessagesReceived(offerId, incomingSendIds);
      const refreshed = await getOfferMessages(offerId);
      setMessages(await buildUnifiedChat(offerItems));
      setChatActions(refreshed.availableActions);
    }
  }, [sessionLogin]);

  const handleSendMessage = useCallback(async (params: {
    offerId: number;
    text: string;
    files: File[];
    canSendMessage: boolean;
    canSendMessageWithAttachments: boolean;
    offerItems: any[];
  }) => {
    if (!params.canSendMessage) {
      return;
    }
    setIsSending(true);
    setChatErrorMessage(null);
    try {
      if (params.files.length > 0) {
        if (!params.canSendMessageWithAttachments) {
          throw new Error('Отправка вложений недоступна для текущего пользователя');
        }
        await sendOfferMessageWithAttachments(params.offerId, params.text, params.files);
      } else {
        await sendOfferMessage(params.offerId, params.text);
      }
      await loadMessages(params.offerId, params.offerItems, false);
    } catch (error) {
      setChatErrorMessage(getErrorMessage(error, 'Не удалось отправить сообщение'));
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [loadMessages]);

  const markReadByInputFocus = useCallback(async (params: {
    offerId: number;
    canSetReadMessages: boolean;
    canSetReceivedMessages: boolean;
    sessionLogin?: string;
    offerItems: any[];
  }) => {
    if (!params.canSetReadMessages || !params.sessionLogin || messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.user_id === params.sessionLogin) {
      return;
    }

    const incomingSendIds = messages.filter((item) => item.user_id !== params.sessionLogin && item.status === 'send').map((item) => item.id);
    const incomingReceivedIds = messages.filter((item) => item.user_id !== params.sessionLogin && item.status === 'received').map((item) => item.id);

    if (params.canSetReceivedMessages && incomingSendIds.length > 0) {
      await markOfferMessagesReceived(params.offerId, incomingSendIds);
    }
    const readIds = [...incomingReceivedIds, ...incomingSendIds];
    if (readIds.length > 0) {
      await markOfferMessagesRead(params.offerId, readIds);
    }
    await loadMessages(params.offerId, params.offerItems, false);
  }, [loadMessages, messages]);

  return { messages, chatActions, isSending, chatErrorMessage, loadMessages, handleSendMessage, markReadByInputFocus, setChatErrorMessage };
};
