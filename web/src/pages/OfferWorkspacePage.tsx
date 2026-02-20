import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Select,
  Stack,
  SvgIcon,
  TextField,
  Typography
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { DataTable } from '@shared/components/DataTable';
import { downloadFile } from '@shared/api/fileDownload';
import { getOfferWorkspace } from '@shared/api/getOfferWorkspace';
import type { OfferWorkspace } from '@shared/api/getOfferWorkspace';
import { createOfferForRequest } from '@shared/api/createOfferForRequest';
import {
  deleteOfferFile,
  getOfferMessages,
  markOfferMessagesRead,
  markOfferMessagesReceived,
  sendOfferMessage,
  sendOfferMessageWithAttachments,
  uploadOfferFile
} from '@shared/api/offerWorkspaceActions';
import type { OfferWorkspaceMessage } from '@shared/api/offerWorkspaceActions';
import { getOfferContractorInfo } from '@shared/api/getOfferContractorInfo';
import type { OfferContractorInfo } from '@shared/api/getOfferContractorInfo';
import { findAvailableAction, hasAvailableAction } from '@shared/auth/availableActions';
import type { AuthLink } from '@shared/api/loginWebUser';
import { updateOfferStatus } from '@shared/api/updateOfferStatus';
import { OfferWorkspaceChatPanel } from '@features/requests/components/OfferWorkspaceChatPanel';
import { ProfileButton } from '@shared/components/ProfileButton';

const statusOptions = [
  { value: 'open', label: 'Открыта', color: '#2e7d32' },
  { value: 'review', label: 'На рассмотрении', color: '#ed6c02' },
  { value: 'closed', label: 'Закрыта', color: '#787878ff' },
  { value: 'cancelled', label: 'Отменена', color: '#d32f2f' }
] as const;

const detailsColumns = [
  { key: 'label', label: 'Параметр' },
  { key: 'value', label: 'Значение' }
];

const offerDecisionOptions = [
  { value: 'accepted', label: 'Принято' },
  { value: 'rejected', label: 'Отказано' }
] as const;

const workspacePollIntervalMs = 7000;
const messagesPollIntervalMs = 7000;

const getOfferStatusBadgeStyle = (status: string | null) => {
  if (status === 'accepted') {
    return {
      borderColor: '#2e7d32',
      icon: (
        <SvgIcon fontSize="small" sx={{ color: '#2e7d32' }}>
          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </SvgIcon>
      )
    };
  }

  if (status === 'submitted') {
    return {
      borderColor: '#2e7d32',
      icon: (
        <SvgIcon fontSize="small" sx={{ color: '#2e7d32' }}>
          <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
        </SvgIcon>
      )
    };
  }

  if (status === 'deleted') {
    return {
      borderColor: '#c62828',
      icon: (
        <SvgIcon fontSize="small" sx={{ color: '#c62828' }}>
          <path d="M11 15h2v2h-2zm0-10h2v8h-2z" />
        </SvgIcon>
      )
    };
  }

  if (status === 'rejected') {
    return {
      borderColor: '#787878',
      icon: (
        <SvgIcon fontSize="small" sx={{ color: '#787878' }}>
          <path d="M19 13H5V11H19V13Z" />
        </SvgIcon>
      )
    };
  }

  return {
    borderColor: '#d3dbe7',
    icon: (
      <SvgIcon fontSize="small" sx={{ color: '#1f2a44' }}>
        <path d="M19 13H5V11H19V13Z" />
      </SvgIcon>
    )
  };
};

const formatDate = (value: string | null, withTime = false) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(date);
};

export const OfferWorkspacePage = () => {
  const { id } = useParams<{ id: string }>();
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const offerId = Number(id ?? 0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contractorInfoRef = useRef<OfferContractorInfo | null>(null);

  const [workspace, setWorkspace] = useState<OfferWorkspace | null>(null);
  const [contractorInfo, setContractorInfo] = useState<OfferContractorInfo | null>(null);
  const [messages, setMessages] = useState<OfferWorkspaceMessage[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<number>(offerId);
  const [chatActions, setChatActions] = useState<AuthLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isUpdatingOfferStatus, setIsUpdatingOfferStatus] = useState(false);
  const [offerDecisionStatus, setOfferDecisionStatus] = useState<'accepted' | 'rejected' | ''>('');

  const loadMessages = useCallback(
    async (targetOfferId: number, syncStatuses = true) => {
      const messagesResponse = await getOfferMessages(targetOfferId);
      setMessages(messagesResponse.items);
      setChatActions(messagesResponse.availableActions);

      if (!syncStatuses || !session?.login) {
        return;
      }

      const canSetReceived = hasAvailableAction(
        { availableActions: messagesResponse.availableActions },
        `/api/v1/offers/${targetOfferId}/messages/received`,
        'PATCH'
      );

      const incomingSendIds = messagesResponse.items
        .filter((item) => item.user_id !== session.login && item.status === 'send')
        .map((item) => item.id);

      let hasStatusUpdates = false;
      if (canSetReceived && incomingSendIds.length > 0) {
        await markOfferMessagesReceived(targetOfferId, incomingSendIds);
        hasStatusUpdates = true;
      }

      if (hasStatusUpdates) {
        const refreshed = await getOfferMessages(targetOfferId);
        setMessages(refreshed.items);
        setChatActions(refreshed.availableActions);
      }
    },
    [session?.login]
  );

  const loadWorkspace = useCallback(async () => {
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const workspaceResponse = await getOfferWorkspace(offerId);
      setWorkspace(workspaceResponse);

      const sortedOffers = [...workspaceResponse.offers].sort(
        (left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime()
      );
      const initialOfferId = sortedOffers.find((item) => item.offer_id === offerId)?.offer_id ?? sortedOffers[0]?.offer_id ?? offerId;
      setSelectedOfferId(initialOfferId);
      await loadMessages(initialOfferId);

      if (workspaceResponse.offer.contractor_user_id) {
        try {
          const contractor = await getOfferContractorInfo(workspaceResponse.offer.contractor_user_id);
          setContractorInfo(contractor);
        } catch {
          setContractorInfo(null);
        }
      } else {
        setContractorInfo(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Ошибка загрузки workspace оффера');
    } finally {
      setIsLoading(false);
    }
  }, [loadMessages, offerId]);

  const refreshWorkspace = useCallback(async (targetOfferId: number) => {
    const nextWorkspace = await getOfferWorkspace(targetOfferId);
    setWorkspace(nextWorkspace);

    setSelectedOfferId((previousSelectedOfferId) => {
      const hasSelectedOffer = nextWorkspace.offers.some((item) => item.offer_id === previousSelectedOfferId);
      if (hasSelectedOffer) {
        return previousSelectedOfferId;
      }

      return nextWorkspace.offers[0]?.offer_id ?? targetOfferId;
    });

    const nextContractorId = nextWorkspace.offer.contractor_user_id;
    if (!nextContractorId) {
      setContractorInfo(null);
      return;
    }

    if (contractorInfoRef.current?.user_id === nextContractorId) {
      return;
    }

    try {
      const contractor = await getOfferContractorInfo(nextContractorId);
      setContractorInfo(contractor);
    } catch {
      setContractorInfo(null);
    }
  }, []);

  useEffect(() => {
    contractorInfoRef.current = contractorInfo;
  }, [contractorInfo]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!selectedOfferId) {
      return;
    }

    const syncWorkspaceData = async () => {
      await refreshWorkspace(selectedOfferId);
      await loadMessages(selectedOfferId);
    };

    void syncWorkspaceData().catch(() => undefined);

    const interval = window.setInterval(() => {
      void syncWorkspaceData().catch(() => undefined);
    }, Math.min(workspacePollIntervalMs, messagesPollIntervalMs));

  return () => window.clearInterval(interval);
  }, [loadMessages, refreshWorkspace, selectedOfferId]);

  useEffect(() => {
    if (!selectedOfferId) {
      return;
    }

    void loadMessages(selectedOfferId).catch(() => undefined);
  }, [loadMessages, selectedOfferId]);

  const availableActions = useMemo(() => {
    if (chatActions.length > 0) {
      return chatActions;
    }

    const currentOfferActions = (workspace?.offers ?? []).find((item) => item.offer_id === selectedOfferId)?.availableActions;
    if (currentOfferActions && currentOfferActions.length > 0) {
      return currentOfferActions;
    }

    return workspace?.availableActions ?? [];
  }, [chatActions, selectedOfferId, workspace?.availableActions, workspace?.offers]);


  const sortedOffers = useMemo(
    () =>
      [...(workspace?.offers ?? [])].sort(
        (left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime()
      ),
    [workspace?.offers]
  );

  const selectedOffer = useMemo(
    () => sortedOffers.find((item) => item.offer_id === selectedOfferId) ?? sortedOffers[0] ?? workspace?.offer ?? null,
    [selectedOfferId, sortedOffers, workspace?.offer]
  );
  const isSelectedOfferSubmitted = selectedOffer?.status === 'submitted';

  const statusConfig = useMemo(
    () => statusOptions.find((item) => item.value === workspace?.request.status) ?? statusOptions[0],
    [workspace?.request.status]
  );

  const isContractor = session?.roleId === 5;
  const isEconomist = session?.roleId === 1 || session?.roleId === 3 || session?.roleId === 4;

  const canUpload = useMemo(
    () =>
      hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/files`, 'POST') &&
      (!isContractor || isSelectedOfferSubmitted),
    [availableActions, isContractor, isSelectedOfferSubmitted, selectedOfferId]
  );
  const canDeleteFile = useMemo(
    () =>
      (
        hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/files/{file_id}`, 'DELETE') ||
        hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/files/1`, 'DELETE')
      ) && (!isContractor || isSelectedOfferSubmitted),
    [availableActions, isContractor, isSelectedOfferSubmitted, selectedOfferId]
  );
  const canSendMessage = useMemo(
    () => hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/messages`, 'POST'),
    [availableActions, selectedOfferId]
  );
  const canSendMessageWithAttachments = useMemo(
    () =>
      hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/messages/attachments`, 'POST') || canSendMessage,
    [availableActions, canSendMessage, selectedOfferId]
  );
  const canSetReadMessages = useMemo(
    () => hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/messages/read`, 'PATCH'),
    [availableActions, selectedOfferId]
  );
  const canSetReceivedMessages = useMemo(
    () => hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/messages/received`, 'PATCH'),
    [availableActions, selectedOfferId]
  );
  const canEditOfferStatus = useMemo(
    () => session?.roleId === 1 || session?.roleId === 3 || session?.roleId === 4,
    [session?.roleId]
  );
  const canDeleteOwnOffer = useMemo(
    () => hasAvailableAction({ availableActions }, `/api/v1/offers/${selectedOfferId}/status`, 'PATCH'),
    [availableActions, selectedOfferId]
  );

  useEffect(() => {
    const next = selectedOffer?.status;
    if (next === 'accepted' || next === 'rejected') {
      setOfferDecisionStatus(next);
      return;
    }

    setOfferDecisionStatus('');
  }, [selectedOffer?.status]);

  const detailsRows = [
    { id: 'created', label: 'Создана', value: formatDate(workspace?.request.created_at ?? null) },
    { id: 'closed', label: 'Закрыта', value: formatDate(workspace?.request.closed_at ?? null) },
    {
      id: 'offer',
      label: 'Номер КП',
      value: workspace?.request.id_offer ?? workspace?.request.chosen_offer_id ?? '-'
    },
    {
      id: 'owner',
      label: 'Ответственный',
      value: workspace?.request.owner_user_id ?? '-'
    },
    { id: 'deadline', label: 'Дедлайн сбора КП', value: formatDate(workspace?.request.deadline_at ?? null) },
    { id: 'updated', label: 'Последнее изменение', value: formatDate(workspace?.request.updated_at ?? null) }
  ];

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !workspace || !selectedOffer) {
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    try {
      await uploadOfferFile(selectedOffer.offer_id, file);
      await refreshWorkspace(selectedOffer.offer_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить файл');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!workspace) {
      return;
    }

    setErrorMessage(null);
    try {
      await deleteOfferFile(selectedOffer.offer_id, fileId);
      await refreshWorkspace(selectedOffer.offer_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось удалить файл');
    }
  };

  const handleSendMessage = async (text: string, files: File[]) => {
    if (!canSendMessage || !selectedOffer) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    try {
      if (files.length > 0) {
        if (!canSendMessageWithAttachments) {
          throw new Error('Отправка вложений недоступна для текущего пользователя');
        }
        await sendOfferMessageWithAttachments(selectedOffer.offer_id, text, files);
      } else {
        await sendOfferMessage(selectedOffer.offer_id, text);
      }
      await loadMessages(selectedOffer.offer_id, false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось отправить сообщение');
    } finally {
      setIsSending(false);
    }
  };

  const handleOfferStatusChange = async (nextStatus: 'accepted' | 'rejected' | '') => {
    if (!workspace || !selectedOffer || !nextStatus || !session?.login) {
      setOfferDecisionStatus(nextStatus);
      return;
    }

    const previousStatus = offerDecisionStatus;
    const confirmMessage =
      nextStatus === 'accepted'
        ? 'Если принять этот оффер, остальные офферы по заявке автоматически получат статус «Отказано». Продолжить?'
        : 'Вы уверены, что хотите изменить статус оффера на «Отказано»?';

    const isConfirmed = window.confirm(confirmMessage);
    if (!isConfirmed) {
      setOfferDecisionStatus(previousStatus);
      return;
    }
    setOfferDecisionStatus(nextStatus);
    setErrorMessage(null);
    setIsUpdatingOfferStatus(true);

    try {
      const response = await updateOfferStatus({
        offer_id: selectedOffer.offer_id,
        status: nextStatus
      });

      setWorkspace((prev) =>
        prev
          ? {
            ...prev,
            offer: prev.offer.offer_id === selectedOffer.offer_id ? { ...prev.offer, status: response.offer.status } : prev.offer,
            offers: prev.offers.map((item) =>
              item.offer_id === selectedOffer.offer_id ? { ...item, status: response.offer.status } : item
            )
          }
          : prev
      );
      await refreshWorkspace(selectedOffer.offer_id);
    } catch (error) {
      setOfferDecisionStatus(previousStatus);
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось обновить статус оффера');
    } finally {
      setIsUpdatingOfferStatus(false);
    }
  };

  const handleDeleteOffer = async () => {
    if (!workspace || !selectedOffer || selectedOffer.status === 'deleted') {
      return;
    }

    const isConfirmed = window.confirm('Вы уверены, что хотите удалить отклик? После удаления отменить действие нельзя, а чат с экономистом будет заблокирован.');
    if (!isConfirmed) {
      return;
    }

    setErrorMessage(null);
    setIsUpdatingOfferStatus(true);
    try {
      const response = await updateOfferStatus({
        offer_id: selectedOffer.offer_id,
        status: 'deleted'
      });

      setWorkspace((prev) =>
        prev
          ? {
            ...prev,
            offer: prev.offer.offer_id === selectedOffer.offer_id ? { ...prev.offer, status: response.offer.status } : prev.offer,
            offers: prev.offers.map((item) =>
              item.offer_id === selectedOffer.offer_id ? { ...item, status: response.offer.status } : item
            )
          }
          : prev
      );
      await refreshWorkspace(selectedOffer.offer_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось удалить отклик');
    } finally {
      setIsUpdatingOfferStatus(false);
    }
  };

  const handleMessageInputClick = async () => {
    if (!canSetReadMessages || !session?.login || messages.length === 0 || !selectedOffer) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.user_id === session.login) {
      return;
    }

    const incomingSendIds = messages
      .filter((item) => item.user_id !== session.login && item.status === 'send')
      .map((item) => item.id);
    const incomingReceivedIds = messages
      .filter((item) => item.user_id !== session.login && item.status === 'received')
      .map((item) => item.id);

    try {
      if (incomingSendIds.length > 0) {
        await markOfferMessagesReceived(selectedOffer.offer_id, incomingSendIds);
      }

      const readIds = [...incomingReceivedIds, ...incomingSendIds];
      if (readIds.length > 0) {
        await markOfferMessagesRead(selectedOffer.offer_id, readIds);
      }

      await loadMessages(selectedOffer.offer_id, false);
    } catch {
      // silent: keep typing flow uninterrupted
    }
  };

  const createOfferAction = useMemo(() => {
    const requestId = workspace?.request.request_id ?? 0;
    const createOfferHref = `/api/v1/requests/${requestId}/offers`;

    const actionSources = [
      workspace?.availableActions ?? [],
      selectedOffer?.availableActions ?? [],
      ...(workspace?.offers ?? []).map((item) => item.availableActions ?? [])
    ];

    for (const source of actionSources) {
      const action = findAvailableAction({ availableActions: source }, createOfferHref, 'POST');
      if (action) {
        return action;
      }
    }

    return null;
  }, [selectedOffer?.availableActions, workspace?.availableActions, workspace?.offers, workspace?.request.request_id]);

  const canCreateNewOffer = Boolean(createOfferAction);

  const handleCreateNewOffer = async () => {
    if (!workspace) {
      return;
    }

    const isConfirmed = window.confirm('Создать новый отклик для этой заявки? Предыдущие удаленные отклики останутся в истории.');
    if (!isConfirmed) {
      return;
    }

    setErrorMessage(null);
    setIsUpdatingOfferStatus(true);
    try {
      const createdOffer = await createOfferForRequest(workspace.request.request_id, createOfferAction ?? undefined);
      const refreshedWorkspace = await getOfferWorkspace(createdOffer.offerId);
      setWorkspace(refreshedWorkspace);
      setSelectedOfferId(createdOffer.offerId);
      await loadMessages(createdOffer.offerId, false);
      navigate(createdOffer.workspacePath, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось создать новый отклик');
    } finally {
      setIsUpdatingOfferStatus(false);
    }
  };


  if (isLoading) {
    return <Typography>Загрузка...</Typography>;
  }

  if (!workspace || !selectedOffer) {
    return <Typography color="text.secondary">Workspace оффера недоступен.</Typography>;
  }

  return (
    <Stack
      direction={{ xs: 'column', lg: 'row' }}
      sx={{
        height: { xs: 'auto', lg: '100vh' },
        minHeight: { xs: 'auto', lg: '100vh' },
        alignItems: 'stretch',
        overflow: { lg: 'hidden' }
      }}
    >
      <Box
        sx={{
          flex: 1,
          p: 2.5,
          backgroundColor: 'rgba(16, 63, 133, 0.06)',
          overflowY: { xs: 'visible', lg: 'auto' },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }}
      >
        {errorMessage ? (
          <Typography color="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Typography>
        ) : null}

        <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            sx={{ px: 4, borderColor: 'primary.main', color: 'primary.main', whiteSpace: 'nowrap' }}
            onClick={() => (isEconomist ? navigate(-1) : navigate('/requests'))}
          >
            {isEconomist ? 'Назад' : 'К списку заявок'}
          </Button>
          <Stack direction="row" spacing={2} alignItems="center">
            <ProfileButton />
            <Button variant="outlined" onClick={logout}>
              Выйти
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
            Номер заявки: {workspace.request.request_id}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'nowrap' }}>
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                backgroundColor: statusConfig.color
              }}
            />
            <Select
              size="small"
              value={statusConfig.value}
              disabled
              sx={{ minWidth: 200, borderRadius: 999, backgroundColor: 'background.paper' }}
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </Stack>
        </Stack>

        <Box
          sx={(theme) => ({
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            padding: { xs: 2, md: 2.5 },
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }
          })}
        >
          <Stack spacing={2}>
            <TextField
              value={workspace.request.description ?? ''}
              multiline
              minRows={6}
              InputProps={{ readOnly: true }}
              sx={{ borderRadius: 3 }}
            />
            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Файлы заявки
              </Typography>
              {workspace.request.files.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {workspace.request.files.map((file) => (
                    <Chip
                      key={file.id}
                      label={file.name}
                      variant="outlined"
                      sx={{ borderRadius: 999, backgroundColor: '#fff' }}
                      onClick={() => void downloadFile(file.download_url, file.name)}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2">Файлы не прикреплены</Typography>
              )}
            </Stack>
          </Stack>

          <DataTable
            columns={detailsColumns}
            rows={detailsRows}
            rowKey={(row) => row.id}
            showHeader={false}
            enableColumnControls={false}
            renderRow={(row) => [
              <Typography variant="body2">{row.label}</Typography>,
              <Typography variant="body2">{row.value}</Typography>
            ]}
          />
        </Box>

        <Paper sx={{ mt: 2.5, p: 2, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Информация о контрагенте
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
              <Typography variant="body2">ИНН: {contractorInfo?.inn ?? workspace.company_contacts?.inn ?? '-'}</Typography>
              <Typography variant="body2">Наименование компании: {contractorInfo?.company_name ?? workspace.company_contacts?.company_name ?? '-'}</Typography>
              <Typography variant="body2">Телефон: {contractorInfo?.company_phone ?? workspace.company_contacts?.phone ?? '-'}</Typography>
              <Typography variant="body2">E-mail: {contractorInfo?.company_mail ?? workspace.company_contacts?.mail ?? '-'}</Typography>
              <Typography variant="body2">Адрес: {contractorInfo?.address ?? workspace.company_contacts?.address ?? '-'}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, width: { xs: '100%', md: 260 } }}>
              <Typography variant="body2">Дополнительная информация</Typography>
              <Typography variant="body2" color="text.secondary">
                {contractorInfo?.note ?? workspace.company_contacts?.note ?? '-'}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, width: { xs: '100%', md: 220 } }}>
              <Typography variant="body2">ФИО: {contractorInfo?.full_name ?? workspace.profile?.full_name ?? '-'}</Typography>
              <Typography variant="body2">Телефон: {contractorInfo?.phone ?? workspace.profile?.phone ?? '-'}</Typography>
              <Typography variant="body2">E-mail: {contractorInfo?.mail ?? workspace.profile?.mail ?? '-'}</Typography>
            </Paper>
          </Stack>
        </Paper>

        {isContractor && canCreateNewOffer ? (
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2.5 }}>
            <Button variant="contained" disabled={isUpdatingOfferStatus} onClick={() => void handleCreateNewOffer()}>
              Новый отклик
            </Button>
          </Stack>
        ) : null}

        {sortedOffers.map((offerItem) => {
          const isCurrent = offerItem.offer_id === selectedOffer.offer_id;
          const itemBadgeStyle = getOfferStatusBadgeStyle(offerItem.status ?? null);
          return (
            <Paper
              key={offerItem.offer_id}
              sx={{
                mt: 2.5,
                p: 2,
                borderRadius: 3,
                border: isCurrent ? '2px solid' : '1px solid',
                borderColor: isCurrent ? 'primary.main' : 'divider'
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 1 }}>
                <Typography variant="h6">Номер КП: {offerItem.offer_id}</Typography>
                {isContractor ? (
                  <Chip
                    label={offerItem.status_label ?? offerItem.status}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: itemBadgeStyle.borderColor,
                      color: itemBadgeStyle.borderColor,
                      backgroundColor: 'transparent',
                      fontWeight: 600
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: `1px solid ${itemBadgeStyle.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'transparent'
                    }}
                    aria-label={`status-${offerItem.status ?? 'unknown'}`}
                  >
                    {itemBadgeStyle.icon}
                  </Box>
                )}

                {canEditOfferStatus && isCurrent ? (
                  <Select
                    size="small"
                    value={offerDecisionStatus}
                    displayEmpty
                    disabled={isUpdatingOfferStatus || offerItem.status === 'deleted'}
                    onChange={(event) => void handleOfferStatusChange(event.target.value as 'accepted' | 'rejected' | '')}
                    sx={{ minWidth: 170 }}
                  >
                    <MenuItem value="">
                      <Typography variant="body2" color="text.secondary">
                        Выберите статус
                      </Typography>
                    </MenuItem>
                    {offerDecisionOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                ) : null}
                {isContractor && canDeleteOwnOffer && isCurrent ? (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    disabled={isUpdatingOfferStatus || offerItem.status === 'deleted'}
                    onClick={() => void handleDeleteOffer()}
                  >
                    {offerItem.status === 'deleted' ? 'Отклик удален' : 'Удалить отклик'}
                  </Button>
                ) : null}
                <Button size="small" variant={isCurrent ? 'contained' : 'outlined'} onClick={() => setSelectedOfferId(offerItem.offer_id)}>
                  {isCurrent ? 'Активный отклик' : 'Открыть в чате'}
                </Button>
              </Stack>
              <Stack spacing={1} sx={{ mb: 1.5 }}>
                <Typography variant="body2">Создана: {formatDate(offerItem.created_at)}</Typography>
                <Typography variant="body2">Последнее изменение: {formatDate(offerItem.updated_at)}</Typography>
              </Stack>

              <Stack direction="row" flexWrap="wrap" gap={1}>
                {offerItem.files.length === 0 ? (
                  <Typography color="text.secondary">Файлы оффера не прикреплены.</Typography>
                ) : (
                  offerItem.files.map((file) => (
                    <Chip
                      key={file.id}
                      label={file.name}
                      variant="outlined"
                      onClick={() => void downloadFile(file.download_url, file.name)}
                      onDelete={canDeleteFile && isCurrent ? () => void handleDeleteFile(file.id) : undefined}
                    />
                  ))
                )}
              </Stack>

              {isCurrent ? <input ref={fileInputRef} type="file" hidden onChange={(event) => void handleUpload(event)} /> : null}
              {canUpload && isCurrent ? (
                <Button sx={{ mt: 1.5 }} variant="outlined" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                  {isUploading ? 'Загрузка...' : 'Прикрепить файл'}
                </Button>
              ) : null}
              
            </Paper>
          );
        })}
      </Box>

      <OfferWorkspaceChatPanel
        offerId={selectedOffer.offer_id}
        chatItems={sortedOffers.map((item) => ({ offerId: item.offer_id, label: `КП ${item.offer_id} · ${item.status_label}` }))}
        activeOfferId={selectedOffer.offer_id}
        onSelectOffer={setSelectedOfferId}
        readOnlyNotice={!canSendMessage && !canSendMessageWithAttachments && !canSetReadMessages && !canSetReceivedMessages ? 'Чат удаленного оффера доступен только для просмотра.' : null}
        isOpen={isChatOpen}
        onToggleOpen={setIsChatOpen}
        messages={messages}
        sessionLogin={session?.login}
        canSendMessage={canSendMessage}
        canSendMessageWithAttachments={canSendMessageWithAttachments}
        isSending={isSending}
        onSendMessage={handleSendMessage}
        onMessageInputClick={handleMessageInputClick}
        onDownloadAttachment={(downloadUrl, name) => {
          void downloadFile(downloadUrl, name);
        }}
        contractorUserId={selectedOffer.contractor_user_id}
      />
    </Stack>
  );
};