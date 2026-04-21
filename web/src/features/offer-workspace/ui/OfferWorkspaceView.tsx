import { useEffect, useRef, useState } from 'react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  MenuItem,
  Select,
  Stack,
  SvgIcon,
  TextField,
  Typography
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { formatDate, formatAmount } from '@shared/lib/formatters';
import { downloadFile } from '@shared/api/fileDownload';
import { OfferWorkspaceChatPanel } from './OfferWorkspaceChatPanel';
import { OFFER_WORKSPACE_CHAT_WIDTH_PX, OfferWorkspaceChatDock } from './OfferWorkspaceChatDock';
import { useOfferWorkspace } from '../model/useOfferWorkspace';
import { RequestDetailsMainCard } from '@features/request-details/ui/RequestDetailsMainCard';
import { statusOptions, type RequestStatus } from '@features/request-details/model/requestDetailsUtils';

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

export const OfferWorkspaceView = () => {
  const theme = useTheme();
  const isDesktopWithSidebar = useMediaQuery(theme.breakpoints.up('lg'));
  const descriptionTextRef = useRef<HTMLParagraphElement | null>(null);
  const [isOfferEditMode, setIsOfferEditMode] = useState(false);
  const {
    session,
    workspace,
    contractorInfo,
    selectedOffer,
    sortedOffers,
    setSelectedOfferId,
    fileInputRef,
    isLoading,
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

  const canViewRequestAmounts = Boolean(workspace?.request.actions.view_amounts);

  const canCreateNewOffer = Boolean(workspace?.request.actions.create_offer);

  const requestStatus = (workspace?.request.status ?? 'open') as RequestStatus;
  const statusTone = requestStatus === 'open'
    ? 'success'
    : requestStatus === 'review'
      ? 'warning'
      : 'neutral';
  const statusColor = statusTone === 'success'
    ? theme.palette.success.main
    : statusTone === 'warning'
      ? theme.palette.warning.main
      : theme.palette.text.secondary;

  useEffect(() => {
    const chatOffset = isDesktopWithSidebar && isChatOpen ? `${OFFER_WORKSPACE_CHAT_WIDTH_PX}px` : '0px';
    document.documentElement.style.setProperty('--offer-workspace-chat-offset', chatOffset);

    return () => {
      document.documentElement.style.setProperty('--offer-workspace-chat-offset', '0px');
    };
  }, [isChatOpen, isDesktopWithSidebar]);

  useEffect(() => {
    setIsOfferEditMode(false);
  }, [selectedOffer?.offer_id]);

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
        height: '100%',
        minHeight: 0,
        alignItems: 'stretch',
        overflow: 'visible',
        minWidth: 0
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          width: { lg: isChatOpen ? `calc(100% - ${OFFER_WORKSPACE_CHAT_WIDTH_PX}px)` : '100%' },
          maxWidth: { lg: isChatOpen ? `calc(100% - ${OFFER_WORKSPACE_CHAT_WIDTH_PX}px)` : '100%' },
          p: 0,
          pr: 0,
          overflowY: { xs: 'visible', lg: 'auto' },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }}
      >

        <RequestDetailsMainCard
          requestId={workspace.request.request_id}
          status={requestStatus}
          statusOptions={statusOptions}
          statusColor={statusColor}
          canEditRequest={false}
          isEditMode={false}
          onStatusChange={() => undefined}
          descriptionText={workspace.request.description ?? ''}
          descriptionTextRef={descriptionTextRef}
          canExpandDescription={false}
          isDescriptionExpanded={false}
          onToggleDescription={() => undefined}
          ownerField={
            <TextField
              size="small"
              value={workspace.request.owner_full_name ?? '-'}
              fullWidth
              InputProps={{ readOnly: true }}
            />
          }
          existingFiles={workspace.request.files}
          canDeleteRequestFiles={false}
          onDownloadFile={(downloadUrl, fileName) => {
            void downloadFile(downloadUrl, fileName);
          }}
          onRemoveExistingFile={() => undefined}
          newFile={null}
          onClearNewFile={() => undefined}
          canUploadRequestFiles={false}
          onNewFileSelected={() => undefined}
          canViewRequestAmounts={canViewRequestAmounts}
          deadline=""
          initialAmount={formatAmount(workspace.request.initial_amount ?? null)}
          finalAmount={formatAmount(workspace.request.final_amount ?? null)}
          onDeadlineChange={() => undefined}
          onInitialAmountChange={() => undefined}
          onFinalAmountChange={() => undefined}
          requestCreatedAt={workspace.request.created_at ?? null}
          requestClosedAt={workspace.request.closed_at ?? null}
          requestDeadlineAt={workspace.request.deadline_at ?? null}
          requestOfferId={workspace.request.id_offer ?? workspace.request.chosen_offer_id ?? '-'}
          requestUpdatedAt={workspace.request.updated_at ?? null}
          isSaving={false}
          canSaveRequestChanges={false}
          hasPendingChanges={false}
          hasValidationError={false}
          canEnterEditMode={false}
          onCancelEditing={() => undefined}
          onSave={() => undefined}
          onStartEdit={() => undefined}
          hideActions
        />

        <Paper
          sx={(themeValue) => ({
            mt: 2.5,
            px: { xs: 2, md: 3 },
            py: { xs: 2, md: 2.5 },
            borderRadius: `${themeValue.acomShape.panelRadius}px`,
            border: `1px solid ${themeValue.palette.divider}`
          })}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            Информация о контрагенте
          </Typography>
          <Stack
            direction="row"
            spacing={2}
            useFlexGap
            flexWrap="wrap"
            alignItems="stretch"
          >
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                flex: '1 1 320px',
                minWidth: 0
              }}
            >
              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" color="text.secondary">ИНН</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>{contractorInfo?.inn ?? workspace.company_contacts?.inn ?? '-'}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" color="text.secondary">Компания</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>{contractorInfo?.company_name ?? workspace.company_contacts?.company_name ?? '-'}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" color="text.secondary">Телефон</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>{contractorInfo?.company_phone ?? workspace.company_contacts?.phone ?? '-'}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" color="text.secondary">E-mail</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right', overflowWrap: 'anywhere' }}>
                    {contractorInfo?.company_mail ?? workspace.company_contacts?.mail ?? '-'}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" color="text.secondary">Адрес</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>{contractorInfo?.address ?? workspace.company_contacts?.address ?? '-'}</Typography>
                </Stack>
              </Stack>
            </Paper>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                flex: '1 1 240px',
                minWidth: { xs: '100%', sm: 220 }
              }}
            >
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">Дополнительная информация</Typography>
                <Typography variant="body2">
                  {contractorInfo?.note ?? workspace.company_contacts?.note ?? '-'}
                </Typography>
              </Stack>
            </Paper>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                flex: '1 1 220px',
                minWidth: { xs: '100%', sm: 220 }
              }}
            >
              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" color="text.secondary">ФИО</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    {contractorInfo?.full_name ?? workspace.profile?.full_name ?? '-'}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" color="text.secondary">Телефон</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    {contractorInfo?.phone ?? workspace.profile?.phone ?? '-'}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" color="text.secondary">E-mail</Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right', overflowWrap: 'anywhere' }}>
                    {contractorInfo?.mail ?? workspace.profile?.mail ?? '-'}
                  </Typography>
                </Stack>
              </Stack>
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
          const isCurrentInEditMode = isCurrent && isOfferEditMode;
          const hasOfferAmountChanges = offerAmountInput !== baselineOfferAmount && offerAmountInput.trim().length > 0;
          const itemBadgeStyle = getOfferStatusBadgeStyle(offerItem.status ?? null);
          return (
            <Paper
              key={offerItem.offer_id}
              sx={(themeValue) => ({
                mt: 2.5,
                px: { xs: 2, md: 3 },
                py: { xs: 2, md: 2.5 },
                borderRadius: `${themeValue.acomShape.panelRadius}px`,
                border: `1px solid ${themeValue.palette.divider}`,
                backgroundColor: themeValue.palette.background.paper
              })}
            >
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                alignItems={{ xs: 'flex-start', lg: 'center' }}
                justifyContent="space-between"
                spacing={1.5}
                useFlexGap
                flexWrap="wrap"
                sx={{ mb: 1.5 }}
              >
                <Stack direction="row" spacing={1.2} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    КП №{offerItem.offer_id}
                  </Typography>
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
                  <Chip
                    label={isCurrent ? 'Активный отклик' : 'Неактивный отклик'}
                    size="small"
                    color={isCurrent ? 'primary' : 'default'}
                    sx={{ borderRadius: 3, '& .MuiChip-label': { fontWeight: 600 } }}
                  />
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  {canEditOfferStatus && isCurrent ? (
                    <Select
                      size="small"
                      value={offerDecisionStatus}
                      displayEmpty
                      disabled={isUpdatingOfferStatus || offerItem.status === 'deleted'}
                      onChange={(event) => void handleStatusChange(event.target.value as 'accepted' | 'rejected' | '')}
                      sx={{
                        minWidth: 230,
                        borderRadius: 3,
                        '& .MuiOutlinedInput-input': { py: 1 }
                      }}
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
                </Stack>
              </Stack>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ mt: 1.5, mb: 1.2 }}
              >
                <Box
                  sx={(themeValue) => ({
                    border: `1px solid ${themeValue.palette.divider}`,
                    borderRadius: `${themeValue.acomShape.controlRadius}px`,
                    backgroundColor: themeValue.palette.background.paper,
                    p: 1.2,
                    minWidth: { sm: 340 },
                    maxWidth: { sm: 380 },
                    display: 'grid',
                    gap: 0.8
                  })}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Создана
                    </Typography>
                    <Typography sx={{ fontWeight: 500, textAlign: 'right' }}>
                      {formatDate(offerItem.created_at)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Сумма КП, руб.
                    </Typography>
                    {isCurrent && canEditOfferAmount && isCurrentInEditMode ? (
                      <TextField
                        size="small"
                        value={offerAmountInput}
                        onChange={(event) => setOfferAmountInput(event.target.value)}
                        disabled={isUpdatingOfferAmount}
                        inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                        sx={{ width: 140, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                      />
                    ) : (
                      <Typography sx={{ fontWeight: 500, textAlign: 'right' }}>
                        {formatAmount(offerItem.offer_amount)}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8 }}>
                Файлы КП
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
                {offerItem.files.length === 0 ? (
                  <Typography color="text.secondary">Файлы КП не прикреплены.</Typography>
                ) : (
                  offerItem.files.map((file) => (
                    <Chip
                      key={file.id}
                      label={file.name}
                      variant="outlined"
                      sx={{ borderRadius: 999, '& .MuiChip-label': { px: 1.2 } }}
                      onClick={() => void downloadFile(file.download_url, file.name)}
                      onDelete={canDeleteFile && isCurrentInEditMode ? () => void handleDeleteFile(file.id) : undefined}
                    />
                  ))
                )}
                {canUpload && isCurrentInEditMode ? (
                  <IconButton
                    size="small"
                    aria-label="Добавить файл"
                    sx={{
                      alignSelf: 'center',
                      color: 'primary.main',
                      width: 32,
                      height: 32,
                      p: 0,
                      '&:hover': {
                        backgroundColor: 'transparent'
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <AddCircleOutlineIcon sx={{ fontSize: 32 }} />
                  </IconButton>
                ) : null}
              </Stack>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.2 }}>
                <Typography variant="body1">Обновлено {formatDate(offerItem.updated_at, true)}</Typography>
                <Stack direction="row" spacing={1}>
                  {isCurrentInEditMode && isContractor && canDeleteOwnOffer ? (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => void handleDeleteOffer()}
                      disabled={isUpdatingOfferStatus || offerItem.status === 'deleted'}
                    >
                      {offerItem.status === 'deleted' ? 'Отклик удален' : 'Удалить отклик'}
                    </Button>
                  ) : null}
                  {isCurrentInEditMode ? (
                    <Button
                      variant="outlined"
                      onClick={() => setIsOfferEditMode(false)}
                      disabled={isUpdatingOfferAmount}
                    >
                      Отмена
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      startIcon={<EditOutlinedIcon />}
                      onClick={() => {
                        if (!isCurrent) {
                          setSelectedOfferId(offerItem.offer_id);
                          return;
                        }
                        setIsOfferEditMode(true);
                      }}
                      disabled={!isCurrent && isUpdatingOfferAmount}
                    >
                      {isCurrent ? 'Изменить' : 'Открыть'}
                    </Button>
                  )}
                  {isCurrentInEditMode && canEditOfferAmount ? (
                    <Button
                      variant={hasOfferAmountChanges ? 'contained' : 'outlined'}
                      onClick={() => void handleOfferAmountSave()}
                      disabled={isUpdatingOfferAmount || !hasOfferAmountChanges}
                    >
                      {isUpdatingOfferAmount ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>

              {isCurrent ? <input ref={fileInputRef} type="file" hidden onChange={(event) => void handleUpload(event)} /> : null}

              {isCurrent && errorMessage ? (
                <Typography role="alert" color="error" sx={{ mt: 1 }}>
                  {errorMessage}
                </Typography>
              ) : null}
              
            </Paper>
          );
        })}
      </Box>

      <OfferWorkspaceChatDock isOpen={isChatOpen} onOpen={() => setIsChatOpen(true)}>
        <OfferWorkspaceChatPanel
          offerId={selectedOffer.offer_id}
          readOnlyNotice={!canSendMessage && !canSendMessageWithAttachments && !canSetReadMessages && !canSetReceivedMessages ? 'Для вас чат доступен только для просмотра.' : null}
          isOpen
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
      </OfferWorkspaceChatDock>
    </Stack>
  );
};
