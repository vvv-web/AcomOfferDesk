import { MouseEvent as ReactMouseEvent, type ReactNode, useMemo, useState } from 'react';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { Box, ButtonBase, Chip, Divider, MenuItem, Paper, Select, Stack, SvgIcon, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { RequestDetailsOffer } from '@shared/api/requests/getRequestDetails';
import { DataTable } from '@shared/components/DataTable';
import { formatDate, formatAmount } from '@shared/lib/formatters';
import { StatusPill, type StatusPillTone } from '@shared/ui/StatusPill';

export type OfferDecisionStatus = 'accepted' | 'rejected' | '';

export type OfferStatusOption = {
  value: OfferDecisionStatus;
  label: string;
};

type OffersTableProps = {
  offers: RequestDetailsOffer[];
  statusMap: Record<number, OfferDecisionStatus>;
  acceptedOfferId?: number | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  statusOptions: OfferStatusOption[];
  onStatusChange: (offerId: number, value: OfferDecisionStatus) => void;
  onOpenWorkspace: (offerId: number) => void;
  onDownloadFile: (downloadUrl: string, fileName: string) => void;
  canChangeStatus?: boolean;
};

type NotificationStyle = {
  borderColor: string;
  icon: ReactNode;
};

const offerStatusLabelMap: Record<string, string> = {
  submitted: 'На рассмотрении',
  accepted: 'Принято',
  rejected: 'Отклонено',
  deleted: 'Удалено'
};

const columns = [
  { key: 'status', label: '', minWidth: 64, fraction: 0.32 },
  { key: 'offerAmount', label: 'Сумма КП', minWidth: 140, fraction: 0.95 },
  { key: 'offerId', label: 'Номер КП', minWidth: 110, fraction: 0.75 },
  { key: 'counterparty', label: 'Контрагент', minWidth: 240, fraction: 1.9 },
  { key: 'contacts', label: 'Контактное лицо', minWidth: 240, fraction: 1.9 },
  { key: 'createdAt', label: 'Дата создания', minWidth: 130, fraction: 0.95 },
  { key: 'updatedAt', label: 'Дата изменения', minWidth: 130, fraction: 0.95 },
  { key: 'file', label: 'КП', minWidth: 190, fraction: 1.25 },
  { key: 'statusSelect', label: 'Статус', minWidth: 210, fraction: 1.35 },
  { key: 'communication', label: 'Общение', minWidth: 190, fraction: 1.2 }
];


const getFileLabelWithHint = (value: string, max = 24) => {
  if (value.length <= max) {
    return value;
  }

  const extIndex = value.lastIndexOf('.');
  const hasExtension = extIndex > 0 && extIndex < value.length - 1;
  const extension = hasExtension ? value.slice(extIndex) : '';
  const base = hasExtension ? value.slice(0, extIndex) : value;
  const maxBase = Math.max(8, max - extension.length - 3);

  return `${base.slice(0, maxBase)}...${extension}`;
};

const getCounterpartyInfo = (offer: RequestDetailsOffer) => {
  const inn = offer.contractor_inn ?? null;
  const companyName = offer.contractor_company_name ?? null;
  const companyPhone = offer.contractor_company_phone ?? offer.contractor_phone ?? null;
  const companyMail = offer.contractor_company_mail ?? offer.contractor_mail ?? null;
  const companyAddress = offer.contractor_address ?? null;
  const companyNote = offer.contractor_note ?? null;

  return [
    `ИНН: ${inn ?? 'Не указано'}`,
    `Наименование компании: ${companyName ?? 'Не указано'}`,
    `Телефон: ${companyPhone ?? 'Не указано'}`,
    `E-mail: ${companyMail ?? 'Не указано'}`,
    `Адрес: ${companyAddress ?? 'Не указано'}`,
    `Дополнительная информация: ${companyNote ?? 'Не указано'}`
  ];
};

const getContactPersonInfo = (offer: RequestDetailsOffer) => {
  const fullName = offer.contractor_full_name ?? null;
  const phone = offer.contractor_contact_phone ?? offer.contractor_phone ?? null;
  const mail = offer.contractor_contact_mail ?? offer.contractor_mail ?? null;
  return [
    `ФИО: ${fullName ?? 'Не указано'}`,
    `Телефон: ${phone ?? 'Не указано'}`,
    `E-mail: ${mail ?? 'Не указано'}`
  ];
};

const notificationIconToneKey: Record<string, keyof import('@mui/material/styles').StatusTones> = {
  accepted: 'success',
  submitted: 'success',
  deleted: 'error',
  rejected: 'neutral',
};

const notificationIconPathByStatus: Record<string, string> = {
  accepted: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  submitted: 'M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z',
  deleted: 'M11 15h2v2h-2zm0-10h2v8h-2z',
};

const getNotificationStyle = (
  status: string | null,
  palette: { divider: string; text: string },
  tones: import('@mui/material/styles').StatusTones
): NotificationStyle => {
  const toneKey = status ? notificationIconToneKey[status] : undefined;
  const tone = toneKey ? tones[toneKey] : undefined;
  const color = tone?.text ?? palette.text;
  const borderColor = tone?.text ?? palette.divider;
  const path = (status ? notificationIconPathByStatus[status] : undefined) ?? 'M19 13H5V11H19V13Z';

  return {
    borderColor,
    icon: (
      <SvgIcon fontSize="small" sx={{ color }}>
        <path d={path} />
      </SvgIcon>
    ),
  };
};

const getUnreadMessagesLabel = (count: number) => {
  if (count <= 0) {
    return null;
  }
  if (count === 1) {
    return 'Новое сообщение';
  }
  return `Новых сообщений: ${count}`;
};

const offerStatusToneKey: Record<string, keyof import('@mui/material/styles').StatusTones> = {
  submitted: 'info',
  accepted: 'success',
  deleted: 'error',
  rejected: 'neutral',
};

const getOfferStatusChipMeta = (status: string | null, tones: import('@mui/material/styles').StatusTones) => {
  const toneKey = status ? offerStatusToneKey[status] : undefined;
  const tone = toneKey ? tones[toneKey] : tones.neutral;
  const label = status ? (offerStatusLabelMap[status] ?? status) : 'Не указано';
  return { label, color: tone.text, backgroundColor: tone.bg };
};

export const OffersTable = ({
  offers,
  statusMap,
  acceptedOfferId,
  isLoading,
  errorMessage,
  statusOptions,
  onStatusChange,
  onOpenWorkspace,
  onDownloadFile,
  canChangeStatus = true
}: OffersTableProps) => {
  const theme = useTheme();
  const statusContent = errorMessage ? <Typography color="error">{errorMessage}</Typography> : undefined;
  const [expandedCardsByOfferId, setExpandedCardsByOfferId] = useState<Record<number, boolean>>({});
  const notificationPalette = {
    divider: theme.palette.divider,
    text: theme.palette.text.primary
  };
  const areAllCardsExpanded = useMemo(
    () => offers.length > 0 && offers.every((offer) => expandedCardsByOfferId[offer.offer_id]),
    [expandedCardsByOfferId, offers]
  );

  const handleToggleCard = (offerId: number) => {
    setExpandedCardsByOfferId((currentState) => ({
      ...currentState,
      [offerId]: !currentState[offerId]
    }));
  };

  const handleToggleAllCards = (shouldExpand: boolean) => {
    if (!shouldExpand) {
      setExpandedCardsByOfferId({});
      return;
    }

    setExpandedCardsByOfferId(
      Object.fromEntries(offers.map((offer) => [offer.offer_id, true])) as Record<number, boolean>
    );
  };

  return (
    <DataTable
      columns={columns}
      rows={offers}
      rowKey={(offer) => offer.offer_id}
      isLoading={isLoading}
      emptyMessage="КП пока не получены."
      statusContent={statusContent}
      storageKey="offers-table"
      searchPlaceholder="Найти КП"
      getRowSearchText={(offer) =>
        [
          offer.offer_id,
          offer.offer_amount,
          offer.contractor_company_name,
          offer.contractor_inn,
          offer.contractor_company_phone,
          offer.contractor_company_mail,
          offer.contractor_address,
          offer.contractor_note,
          offer.contractor_full_name,
          offer.contractor_contact_phone,
          offer.contractor_contact_mail,
          offer.status,
          offer.created_at,
          offer.updated_at,
          offer.files.map((file) => file.name).join(' ')
        ]
          .filter(Boolean)
          .join(' ')
      }
      onRowClick={(offer) => onOpenWorkspace(offer.offer_id)}
      cardExpansionControl={{
        checked: areAllCardsExpanded,
        onChange: handleToggleAllCards,
        openLabel: 'Раскрыть все',
        closeLabel: 'Свернуть все'
      }}
      renderCard={(offer) => {
        const currentStatus = statusMap[offer.offer_id] ?? '';
        const unreadCount = offer.unread_messages_count ?? 0;
        const unreadLabel = getUnreadMessagesLabel(unreadCount);
        const statusChipMeta = getOfferStatusChipMeta(offer.status, theme.palette.statusTones);
        const statusPillTone: StatusPillTone = (offer.status ? offerStatusToneKey[offer.status] : undefined) ?? 'neutral';
        const isExpanded = Boolean(expandedCardsByOfferId[offer.offer_id]);
        const canChangeCurrentOfferStatus =
          canChangeStatus && offer.status !== 'deleted' && (offer.actions.accept || offer.actions.reject);
        const handleToggleExpand = (event: ReactMouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          handleToggleCard(offer.offer_id);
        };

        return (
          <Paper
            onClick={() => onOpenWorkspace(offer.offer_id)}
            sx={{
              p: { xs: 1.25, sm: 1.5 },
              borderRadius: `${theme.acomShape.controlRadius}px`,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`,
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: `0 6px 14px ${alpha(theme.palette.common.black, 0.08)}`
              }
            }}
          >
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                <Stack sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>
                    {`КП №${offer.offer_id}`}
                  </Typography>
                  <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                    {formatAmount(offer.offer_amount)}
                  </Typography>
                </Stack>
                <StatusPill label={statusChipMeta.label} tone={statusPillTone} />
              </Stack>

              <Typography
                sx={{
                  fontSize: 14,
                  color: 'text.secondary',
                  display: '-webkit-box',
                  WebkitLineClamp: isExpanded ? 'unset' : 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: isExpanded ? 'normal' : 'initial',
                  wordBreak: 'break-word'
                }}
              >
                {offer.contractor_company_name ?? 'Компания не указана'}
              </Typography>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {`Обновлено: ${formatDate(offer.updated_at)}`}
                </Typography>
                <ButtonBase
                  onClick={handleToggleExpand}
                  sx={{
                    px: 0.5,
                    py: 0.25,
                    borderRadius: `${theme.acomShape.controlRadius}px`,
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.06) }
                  }}
                >
                  <Stack direction="row" alignItems="center" gap={0.25}>
                    <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                      {isExpanded ? 'свернуть' : 'подробнее'}
                    </Typography>
                    <ExpandMoreRounded
                      sx={{
                        fontSize: 20,
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.28s ease'
                      }}
                    />
                  </Stack>
                </ButtonBase>
              </Stack>

              {isExpanded && (
                <>
                  <Divider />
                  <Stack spacing={1}>
                    <Typography sx={{ fontSize: 14, color: 'text.primary' }}>
                      {`Контакт: ${offer.contractor_full_name ?? 'Не указано'}`}
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: 'text.secondary', wordBreak: 'break-word' }}>
                      {`Телефон: ${offer.contractor_contact_phone ?? offer.contractor_phone ?? 'Не указано'}`}
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: 'text.secondary', wordBreak: 'break-word' }}>
                      {`E-mail: ${offer.contractor_contact_mail ?? offer.contractor_mail ?? 'Не указано'}`}
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                      {`Создано: ${formatDate(offer.created_at)}`}
                    </Typography>
                    <Select
                      size="small"
                      value={currentStatus}
                      displayEmpty
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onStatusChange(offer.offer_id, event.target.value as OfferDecisionStatus)}
                      disabled={!canChangeCurrentOfferStatus}
                      sx={{ width: '100%' }}
                    >
                      <MenuItem value="">
                        <Typography variant="body2" color="text.secondary">
                          Выберите
                        </Typography>
                      </MenuItem>
                      {statusOptions.map((option) => {
                        const isAcceptedBlocked =
                          option.value === 'accepted'
                          && (Boolean(acceptedOfferId) && acceptedOfferId !== offer.offer_id || !offer.actions.accept);
                        const isRejectedBlocked = option.value === 'rejected' && !offer.actions.reject;

                        return (
                          <MenuItem key={option.value} value={option.value} disabled={isAcceptedBlocked || isRejectedBlocked}>
                            {option.label}
                          </MenuItem>
                        );
                      })}
                    </Select>
                    {offer.files.length > 0 ? (
                      <Stack direction="row" flexWrap="wrap" gap={0.7}>
                        {offer.files.map((file) => (
                          <Tooltip key={`${offer.offer_id}-${file.id}`} title={file.name} arrow>
                            <Chip
                              label={getFileLabelWithHint(file.name)}
                              variant="outlined"
                              size="small"
                              sx={{
                                borderRadius: 999,
                                backgroundColor: 'background.paper',
                                cursor: 'pointer',
                                maxWidth: '100%',
                                '& .MuiChip-label': {
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 170
                                }
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                void onDownloadFile(file.download_url, file.name);
                              }}
                            />
                          </Tooltip>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Файлы отсутствуют
                      </Typography>
                    )}
                  </Stack>
                </>
              )}

              <Divider />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: `1px solid ${getNotificationStyle(offer.status, notificationPalette, theme.palette.statusTones).borderColor}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {getNotificationStyle(offer.status, notificationPalette, theme.palette.statusTones).icon}
                </Box>
                {unreadLabel ? (
                  <Chip
                    label={unreadLabel}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: theme.palette.primary.main,
                      color: theme.palette.primary.main,
                      fontWeight: 600,
                      backgroundColor: 'transparent'
                    }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Без новых сообщений
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Paper>
        );
      }}
      renderRow={(offer) => {
        const notificationStyle = getNotificationStyle(offer.status, notificationPalette, theme.palette.statusTones);
        const counterpartyInfo = getCounterpartyInfo(offer);
        const contactPersonInfo = getContactPersonInfo(offer);
        const currentStatus = statusMap[offer.offer_id] ?? '';

        return [
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: `1px solid ${notificationStyle.borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                fontWeight: 700
              }}
            >
              {notificationStyle.icon}
            </Box>
          </Box>,
          <Typography variant="body2">{formatAmount(offer.offer_amount)}</Typography>,
          <Typography variant="body2" fontWeight={600}>{offer.offer_id}</Typography>,
          <Stack spacing={0.5}>
            {counterpartyInfo.map((item) => (
              <Typography key={item} variant="body2">
                {item}
              </Typography>
            ))}
          </Stack>,
          <Stack spacing={0.5}>
            {contactPersonInfo.map((item) => (
              <Typography key={item} variant="body2">
                {item}
              </Typography>
            ))}
          </Stack>,
          <Typography variant="body2">{formatDate(offer.created_at)}</Typography>,
          <Typography variant="body2">{formatDate(offer.updated_at)}</Typography>,
          offer.files.length > 0 ? (
            <Stack direction="row" flexWrap="wrap" gap={0.7}>
              {offer.files.map((file) => (
                <Tooltip key={file.id} title={file.name} arrow>
                  <Chip
                    label={getFileLabelWithHint(file.name)}
                    variant="outlined"
                    size="small"
                    sx={{
                      borderRadius: 999,
                      backgroundColor: 'background.paper',
                      cursor: 'pointer',
                      maxWidth: '100%',
                      '& .MuiChip-label': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 170
                      }
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onDownloadFile(file.download_url, file.name);
                    }}
                  />
                </Tooltip>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2">-</Typography>
          ),
          <Select
            size="small"
            value={currentStatus}
            displayEmpty
            onChange={(event) => onStatusChange(offer.offer_id, event.target.value as OfferDecisionStatus)}
            onClick={(event) => event.stopPropagation()}
            disabled={!canChangeStatus || offer.status === 'deleted' || (!offer.actions.accept && !offer.actions.reject)}
            sx={{
              minWidth: 200,
              width: '100%',
              '& .MuiSelect-select': {
                whiteSpace: 'nowrap',
                overflow: 'visible',
                textOverflow: 'clip'
              }
            }}
          >
            <MenuItem value="">
              <Typography variant="body2" color="text.secondary">
                Выберите
              </Typography>
            </MenuItem>
            {statusOptions.map((option) => {
              const isAcceptedBlocked =
                option.value === 'accepted'
                && (Boolean(acceptedOfferId) && acceptedOfferId !== offer.offer_id || !offer.actions.accept);
              const isRejectedBlocked = option.value === 'rejected' && !offer.actions.reject;

              return (
                <MenuItem key={option.value} value={option.value} disabled={isAcceptedBlocked || isRejectedBlocked}>
                  {option.label}
                </MenuItem>
              );
            })}
          </Select>,
          <Stack spacing={1} alignItems="flex-start">
            {(() => {
              const unreadCount = offer.unread_messages_count ?? 0;
              const unreadLabel = getUnreadMessagesLabel(unreadCount);

              if (!unreadLabel) {
                return (
                  <Typography variant="body2" color="text.secondary">
                    Откройте КП нажатием на строку
                  </Typography>
                );
              }

              return (
                <Chip
                  label={unreadLabel}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: theme.palette.primary.main,
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                    backgroundColor: 'transparent'
                  }}
                />
              );
            })()}
          </Stack>
        ];
      }}
    />
  );
};
