import type { ReactNode } from 'react';
import { Box, Chip, MenuItem, Select, Stack, SvgIcon, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { RequestDetailsOffer } from '@shared/api/requests/getRequestDetails';
import { DataTable } from '@shared/components/DataTable';

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

const formatDate = (value: string | null) => {
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
    year: 'numeric'
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

const getNotificationStyle = (
  status: string | null,
  palette: { divider: string; text: string }
): NotificationStyle => {
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
    borderColor: palette.divider,
    icon: (
      <SvgIcon fontSize="small" sx={{ color: palette.text }}>
        <path d="M19 13H5V11H19V13Z" />
      </SvgIcon>
    )
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
  const notificationPalette = {
    divider: theme.palette.divider,
    text: theme.palette.text.primary
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
      renderRow={(offer) => {
        const notificationStyle = getNotificationStyle(offer.status, notificationPalette);
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
                      backgroundColor: '#fff',
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
