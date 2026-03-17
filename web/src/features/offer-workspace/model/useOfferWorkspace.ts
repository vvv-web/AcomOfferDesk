import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { getOfferWorkspace } from '@shared/api/offers/getOfferWorkspace';
import type { OfferWorkspace } from '@shared/api/offers/getOfferWorkspace';
import { getOfferContractorInfo } from '@shared/api/offers/getOfferContractorInfo';
import type { OfferContractorInfo } from '@shared/api/offers/getOfferContractorInfo';
import { createOfferForRequest } from '@shared/api/offers/createOfferForRequest';
import { deleteOfferFile, uploadOfferFile } from '@shared/api/offers/offerWorkspaceActions';
import { updateOfferStatus } from '@shared/api/offers/updateOfferStatus';
import { findAvailableAction, hasAvailableAction } from '@shared/auth/availableActions';
import { ROLE } from '@shared/constants/roles';
import { getErrorMessage } from '@shared/lib/errors';
import { useOfferMessages } from './useOfferMessages';

const workspacePollIntervalMs = 7000;

export const useOfferWorkspace = () => {
  const { id } = useParams<{ id: string }>();
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const offerId = Number(id ?? 0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contractorInfoRef = useRef<OfferContractorInfo | null>(null);

  const [workspace, setWorkspace] = useState<OfferWorkspace | null>(null);
  const [contractorInfo, setContractorInfo] = useState<OfferContractorInfo | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<number>(offerId);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isUpdatingOfferStatus, setIsUpdatingOfferStatus] = useState(false);
  const [offerDecisionStatus, setOfferDecisionStatus] = useState<'accepted' | 'rejected' | ''>('');

  const { messages, chatActions, isSending, chatErrorMessage, loadMessages, handleSendMessage, markReadByInputFocus } = useOfferMessages(session?.login);

  const sortedOffers = useMemo(
    () => [...(workspace?.offers ?? [])].sort((left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime()),
    [workspace?.offers]
  );
  const selectedOffer = useMemo(
    () => sortedOffers.find((item) => item.offer_id === selectedOfferId) ?? sortedOffers[0] ?? workspace?.offer ?? null,
    [selectedOfferId, sortedOffers, workspace?.offer]
  );

  const refreshWorkspace = useCallback(async (targetOfferId: number) => {
    const nextWorkspace = await getOfferWorkspace(targetOfferId);
    setWorkspace(nextWorkspace);
    setSelectedOfferId((prev) => (nextWorkspace.offers.some((item) => item.offer_id === prev) ? prev : nextWorkspace.offers[0]?.offer_id ?? targetOfferId));

    const nextContractorId = nextWorkspace.offer.contractor_user_id;
    if (!nextContractorId) {
      setContractorInfo(null);
      return nextWorkspace;
    }
    if (contractorInfoRef.current?.user_id === nextContractorId) {
      return nextWorkspace;
    }
    try {
      setContractorInfo(await getOfferContractorInfo(nextContractorId));
    } catch {
      setContractorInfo(null);
    }

    return nextWorkspace;
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const workspaceResponse = await getOfferWorkspace(offerId);
      setWorkspace(workspaceResponse);
      const initialOfferId = workspaceResponse.offers.find((item) => item.offer_id === offerId)?.offer_id ?? workspaceResponse.offers[0]?.offer_id ?? offerId;
      setSelectedOfferId(initialOfferId);
      await loadMessages(initialOfferId, workspaceResponse.offers);

      if (workspaceResponse.offer.contractor_user_id) {
        try {
          setContractorInfo(await getOfferContractorInfo(workspaceResponse.offer.contractor_user_id));
        } catch {
          setContractorInfo(null);
        }
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Ошибка загрузки workspace оффера'));
    } finally {
      setIsLoading(false);
    }
  }, [loadMessages, offerId]);

  useEffect(() => {
    contractorInfoRef.current = contractorInfo;
  }, [contractorInfo]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  useEffect(() => {
    if (!selectedOfferId) return;
    const sync = async () => {
      const nextWorkspace = await refreshWorkspace(selectedOfferId);
      await loadMessages(selectedOfferId, nextWorkspace.offers);
    };
    void sync().catch(() => undefined);
    const interval = window.setInterval(() => { void sync().catch(() => undefined); }, workspacePollIntervalMs);
    return () => window.clearInterval(interval);
  }, [selectedOfferId, refreshWorkspace, loadMessages]);

  const availableActions = useMemo(() => {
    if (chatActions.length > 0) return chatActions;
    return (workspace?.offers ?? []).find((item) => item.offer_id === selectedOfferId)?.availableActions ?? workspace?.availableActions ?? [];
  }, [chatActions, selectedOfferId, workspace]);

  const isContractor = session?.roleId === ROLE.CONTRACTOR;
  const isEconomist = session?.roleId === ROLE.SUPERADMIN || session?.roleId === ROLE.LEAD_ECONOMIST || session?.roleId === ROLE.PROJECT_MANAGER || session?.roleId === ROLE.ECONOMIST;
  const isSelectedOfferSubmitted = selectedOffer?.status === 'submitted';
  const canUpload = hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/files`, 'POST') && (!isContractor || isSelectedOfferSubmitted);
  const canDeleteFile = (hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/files/{file_id}`, 'DELETE') || hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/files/1`, 'DELETE')) && (!isContractor || isSelectedOfferSubmitted);
  const canSendMessage = hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/messages`, 'POST');
  const canSendMessageWithAttachments = hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/messages/attachments`, 'POST') || canSendMessage;
  const canSetReadMessages = hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/messages/read`, 'PATCH');
  const canSetReceivedMessages = hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/messages/received`, 'PATCH');
  const canEditOfferStatus = session?.roleId === ROLE.SUPERADMIN || session?.roleId === ROLE.LEAD_ECONOMIST || session?.roleId === ROLE.PROJECT_MANAGER;
  const canDeleteOwnOffer = isContractor && hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}`, 'PATCH');

  const acceptedOfferId = sortedOffers.find((item) => item.status === 'accepted')?.offer_id ?? null;

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedOffer) return;
    setIsUploading(true);
    setErrorMessage(null);
    try {
      await uploadOfferFile(selectedOffer.offer_id, file);
      await refreshWorkspace(selectedOffer.offer_id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Не удалось загрузить файл'));
    } finally { setIsUploading(false); }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!selectedOffer) return;
    try {
      await deleteOfferFile(selectedOffer.offer_id, fileId);
      await refreshWorkspace(selectedOffer.offer_id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Не удалось удалить файл'));
    }
  };

  const handleStatusChange = async (nextStatus: 'accepted' | 'rejected' | '') => {
    if (!selectedOffer || !nextStatus) return;
    if (nextStatus === 'accepted' && acceptedOfferId && acceptedOfferId !== selectedOffer.offer_id) {
      setErrorMessage('Нельзя одобрить более одного оффера в рамках одной заявки');
      return;
    }
    const confirmed = window.confirm(nextStatus === 'accepted' ? 'Если принять этот оффер, остальные офферы по заявке автоматически получат статус «Отказано». Продолжить?' : 'Вы уверены, что хотите изменить статус оффера на «Отказано»?');
    if (!confirmed) return;
    setOfferDecisionStatus(nextStatus);
    setIsUpdatingOfferStatus(true);
    try {
      await updateOfferStatus({ offer_id: selectedOffer.offer_id, status: nextStatus });
      await refreshWorkspace(selectedOffer.offer_id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Не удалось обновить статус оффера'));
    } finally {
      setIsUpdatingOfferStatus(false);
    }
  };

  const handleDeleteOffer = async () => {
    if (!selectedOffer || selectedOffer.status === 'deleted') return;
    if (!window.confirm('Вы уверены, что хотите удалить отклик? После удаления отменить действие нельзя.')) return;
    setIsUpdatingOfferStatus(true);
    try {
      await updateOfferStatus({ offer_id: selectedOffer.offer_id, status: 'deleted' });
      await refreshWorkspace(selectedOffer.offer_id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Не удалось удалить отклик'));
    } finally { setIsUpdatingOfferStatus(false); }
  };

  const handleCreateNewOffer = async () => {
    if (!workspace) return;
    const createOfferAction = findAvailableAction({ availableActions: workspace.availableActions ?? [] }, `/api/v1/requests/${workspace.request.request_id}/offers`, 'POST');
    if (!createOfferAction) return;
    if (!window.confirm('Создать новый отклик для этой заявки? Предыдущие удаленные отклики останутся в истории.')) return;
    setIsUpdatingOfferStatus(true);
    try {
      const createdOffer = await createOfferForRequest(workspace.request.request_id, createOfferAction);
      const refreshedWorkspace = await getOfferWorkspace(createdOffer.offerId);
      setWorkspace(refreshedWorkspace);
      setSelectedOfferId(createdOffer.offerId);
      await loadMessages(createdOffer.offerId, refreshedWorkspace.offers, false);
      navigate(createdOffer.workspacePath, { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Не удалось создать новый отклик'));
    } finally { setIsUpdatingOfferStatus(false); }
  };

  return {
    session,
    logout,
    navigate,
    workspace,
    contractorInfo,
    selectedOffer,
    sortedOffers,
    selectedOfferId,
    setSelectedOfferId,
    fileInputRef,
    isLoading,
    isUploading,
    errorMessage: errorMessage ?? chatErrorMessage,
    isChatOpen,
    setIsChatOpen,
    offerDecisionStatus,
    isUpdatingOfferStatus,
    messages,
    isSending,
    canUpload,
    canDeleteFile,
    canSendMessage,
    canSendMessageWithAttachments,
    canSetReadMessages,
    canSetReceivedMessages,
    canEditOfferStatus,
    canDeleteOwnOffer,
    isEconomist,
    isContractor,
    acceptedOfferId,
    handleUpload,
    handleDeleteFile,
    handleStatusChange,
    handleDeleteOffer,
    handleCreateNewOffer,
    onSendMessage: async (text: string, files: File[]) => {
      if (!selectedOffer || !workspace) return;
      await handleSendMessage({ offerId: selectedOffer.offer_id, text, files, canSendMessage, canSendMessageWithAttachments, offerItems: workspace.offers });
    },
    onMessageInputClick: async () => {
      if (!selectedOffer || !workspace) return;
      await markReadByInputFocus({ offerId: selectedOffer.offer_id, canSetReadMessages, canSetReceivedMessages, sessionLogin: session?.login, offerItems: workspace.offers });
    }
  };
};
