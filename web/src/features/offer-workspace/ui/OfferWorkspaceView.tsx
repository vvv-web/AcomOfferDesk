import { useMemo } from 'react';
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
import { DataTable } from '@shared/components/DataTable';
import { downloadFile } from '@shared/api/fileDownload';
import { OfferWorkspaceChatPanel } from './OfferWorkspaceChatPanel';
import { ProfileButton } from '@shared/components/ProfileButton';
import { useOfferWorkspace } from '../model/useOfferWorkspace';

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

const formatAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export const OfferWorkspaceView = () => {
  const {
    session,
    logout,
    navigate,
    workspace,
    contractorInfo,
    selectedOffer,
    sortedOffers,
    setSelectedOfferId,
    fileInputRef,
    isLoading,
    isUploading,
    errorMessage,
    isChatOpen,
    setIsChatOpen,
    offerDecisionStatus,
    isUpdatingOfferStatus,
    isUpdatingOfferAmount,
    messages,
    typingUserIds,
    isSending,
    canUpload,
    canDeleteFile,
    canSendMessage,
    canSendMessageWithAttachments,
    canSetReadMessages,
    canSetReceivedMessages,
    canEditOfferStatus,
    canEditOfferAmount,
    canDeleteOwnOffer,
    isEconomist,
    isContractor,
    acceptedOfferId,
    offerAmountInput,
    setOfferAmountInput,
    baselineOfferAmount,
    handleUpload,
    handleDeleteFile,
    handleStatusChange,
    handleOfferAmountSave,
    handleDeleteOffer,
    handleCreateNewOffer,
    onSendMessage,
    onMessageInputClick,
    onMessageDraftChange
  } = useOfferWorkspace();

  const statusConfig = useMemo(
    () => statusOptions.find((item) => item.value === workspace?.request.status) ?? statusOptions[0],
    [workspace?.request.status]
  );
  const canViewRequestAmounts = Boolean(workspace?.request.actions.view_amounts);

  const detailsRows = [
    ...(canViewRequestAmounts
      ? [
          { id: 'initialAmount', label: 'Сумма по ТЗ', value: formatAmount(workspace?.request.initial_amount ?? null) },
          { id: 'finalAmount', label: 'Итоговая сумма', value: formatAmount(workspace?.request.final_amount ?? null) }
        ]
      : []),
    { id: 'owner', label: 'Ответственный', value: workspace?.request.owner_full_name ?? '-' },
    { id: 'created', label: 'Создана', value: formatDate(workspace?.request.created_at ?? null) },
    { id: 'closed', label: 'Закрыта', value: formatDate(workspace?.request.closed_at ?? null) },
    { id: 'offer', label: 'Номер КП', value: workspace?.request.id_offer ?? workspace?.request.chosen_offer_id ?? '-' },
    { id: 'deadline', label: 'Дедлайн', value: formatDate(workspace?.request.deadline_at ?? null) },
    { id: 'updated', label: 'Последнее изменение', value: formatDate(workspace?.request.updated_at ?? null) }
  ];

  const canCreateNewOffer = Boolean(workspace?.request.actions.create_offer);

  if (isLoading) {
    return <Typography>Загрузка...</Typography>;
  }

  if (!workspace || !selectedOffer) {
    return <Typography color="text.secondary">Рабочее пространство КП недоступно.</Typography>;
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
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>E-mail: {contractorInfo?.company_mail ?? workspace.company_contacts?.mail ?? '-'}</Typography>
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
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>E-mail: {contractorInfo?.mail ?? workspace.profile?.mail ?? '-'}</Typography>
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
                    onChange={(event) => void handleStatusChange(event.target.value as 'accepted' | 'rejected' | '')}
                    sx={{ minWidth: 170 }}
                  >
                    <MenuItem value="">
                      <Typography variant="body2" color="text.secondary">
                        Выберите статус
                      </Typography>
                    </MenuItem>
                    {offerDecisionOptions.map((option) => {
                      const isAcceptedBlocked = option.value === 'accepted' && Boolean(acceptedOfferId) && acceptedOfferId !== offerItem.offer_id;
                      return (
                        <MenuItem key={option.value} value={option.value} disabled={isAcceptedBlocked}>
                          {option.label}
                        </MenuItem>
                      );
                    })}
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

              <Stack spacing={1} sx={{ mb: 1.5 }}>
                <Typography variant="body2">Сумма КП: {formatAmount(offerItem.offer_amount)}</Typography>
                {isCurrent && canEditOfferAmount ? (
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                  >
                    <TextField
                      size="small"
                      label="Сумма КП"
                      value={offerAmountInput}
                      onChange={(event) => setOfferAmountInput(event.target.value)}
                      disabled={isUpdatingOfferAmount}
                      inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                      sx={{ width: { xs: '100%', md: 220 } }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => void handleOfferAmountSave()}
                      disabled={isUpdatingOfferAmount || offerAmountInput === baselineOfferAmount || !offerAmountInput.trim()}
                    >
                      {isUpdatingOfferAmount ? 'Сохранение...' : 'Сохранить сумму'}
                    </Button>
                  </Stack>
                ) : null}
              </Stack>

              <Stack direction="row" flexWrap="wrap" gap={1}>
                {offerItem.files.length === 0 ? (
                  <Typography color="text.secondary">Файлы КП не прикреплены.</Typography>
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

              {isCurrent && errorMessage ? (
                <Typography color="error" sx={{ mt: 1 }}>
                  {errorMessage}
                </Typography>
              ) : null}
              
            </Paper>
          );
        })}
      </Box>

      <OfferWorkspaceChatPanel
        offerId={selectedOffer.offer_id}
        readOnlyNotice={!canSendMessage && !canSendMessageWithAttachments && !canSetReadMessages && !canSetReceivedMessages ? 'Для вас чат доступен только для просмотра.' : null}
        isOpen={isChatOpen}
        onToggleOpen={setIsChatOpen}
        messages={messages}
        typingUserIds={typingUserIds}
        sessionLogin={session?.login}
        canSendMessage={canSendMessage}
        canSendMessageWithAttachments={canSendMessageWithAttachments}
        isSending={isSending}
        onSendMessage={onSendMessage}
        onMessageInputClick={onMessageInputClick}
        onMessageDraftChange={onMessageDraftChange}
        onDownloadAttachment={(downloadUrl, name) => {
          void downloadFile(downloadUrl, name);
        }}
        contractorUserId={selectedOffer.contractor_user_id}
      />
    </Stack>
  );
};
