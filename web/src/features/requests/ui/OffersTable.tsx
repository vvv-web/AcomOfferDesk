<<<<<<< HEAD
import { MouseEvent as ReactMouseEvent, useState, type ReactNode } from 'react';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { Box, ButtonBase, Chip, Collapse, Divider, MenuItem, Paper, Select, Stack, SvgIcon, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { RequestDetailsOffer } from '@shared/api/requests/getRequestDetails';
import { TableTemplate, type TableTemplateColumn } from '@shared/components/TableTemplate';
=======
﻿import { MouseEvent as ReactMouseEvent, type ReactNode, useMemo, useState } from 'react';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { Box, ButtonBase, Chip, Divider, MenuItem, Paper, Select, Stack, SvgIcon, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { RequestDetailsOffer } from '@shared/api/requests/getRequestDetails';
import { DataTable } from '@shared/components/DataTable';
import { formatDate, formatAmount } from '@shared/lib/formatters';
import { StatusPill, type StatusPillTone } from '@shared/ui/StatusPill';
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810

export type OfferDecisionStatus = 'accepted' | 'rejected' | '';

export type OfferStatusOption = {
  value: OfferDecisionStatus;
  label: string;
};

type OfferMobileCardProps = {
    offer: RequestDetailsOffer;
    selectedStatus: OfferDecisionStatus;
    statusOptions: OfferStatusOption[];
    acceptedOfferId?: number | null;
    canChangeStatus: boolean;
    onStatusChange: (offerId: number, value: OfferDecisionStatus) => void;
    onDownloadFile: (downloadUrl: string, fileName: string) => void;
    onOpenWorkspace: (offerId: number) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
};

type OffersTableProps = {
<<<<<<< HEAD
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
    onAddClick?: () => void;
=======
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
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
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

<<<<<<< HEAD
=======
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

>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810

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

const OfferMobileCard = ({
    offer,
    selectedStatus,
    statusOptions,
    acceptedOfferId,
    canChangeStatus,
    onStatusChange,
    onDownloadFile,
    onOpenWorkspace,
    isExpanded,
    onToggleExpand
}: OfferMobileCardProps) => {
    const theme = useTheme();
    const notificationStyle = getNotificationStyle(offer.status, {
        divider: theme.palette.divider,
        text: theme.palette.text.primary
    });
    const detailRows = [
        {
            label: 'Контрагент',
            content: (
                <Stack spacing={0.35}>
                    {getCounterpartyInfo(offer).map((line) => (
                        <Typography key={`ctr-${offer.offer_id}-${line}`} variant="body2">
                            {line}
                        </Typography>
                    ))}
                </Stack>
            )
        },
        {
            label: 'Контактное лицо',
            content: (
                <Stack spacing={0.35}>
                    {getContactPersonInfo(offer).map((line) => (
                        <Typography key={`contact-${offer.offer_id}-${line}`} variant="body2">
                            {line}
                        </Typography>
                    ))}
                </Stack>
            )
        },
        {
            label: 'Дата создания',
            content: <Typography variant="body2">{formatDate(offer.created_at)}</Typography>
        },
        {
            label: 'Дата изменения',
            content: <Typography variant="body2">{formatDate(offer.updated_at)}</Typography>
        },
        {
            label: 'КП',
            content:
                offer.files.length > 0 ? (
                    <Stack direction="row" flexWrap="wrap" gap={0.7}>
                        {offer.files.map((file) => (
                            <Tooltip key={`card-file-${file.id}`} title={file.name} arrow>
                                <Chip
                                    label={getFileLabelWithHint(file.name)}
                                    variant="outlined"
                                    size="small"
                                    sx={{
                                        borderRadius: 999,
                                        bgcolor: 'background.paper',
                                        cursor: 'pointer',
                                        maxWidth: '100%',
                                        '& .MuiChip-label': {
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
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
                        -
                    </Typography>
                )
        }
    ];

    const unreadLabel = getUnreadMessagesLabel(offer.unread_messages_count ?? 0);
    const handleToggleExpand = (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onToggleExpand();
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
            <Stack spacing={1.15}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Stack sx={{ minWidth: 0, gap: 0.2 }}>
                        <Typography
                            sx={{
                                minWidth: 0,
                                fontSize: 16,
                                fontWeight: 600,
                                color: 'text.primary',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word'
                            }}
                        >
                            {offer.contractor_company_name ?? offer.contractor_full_name ?? `КП №${offer.offer_id}`}
                        </Typography>
                        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{`КП №${offer.offer_id}`}</Typography>
                    </Stack>

                    <Stack
                        onClick={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()}
                        onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()}
                        sx={{ minWidth: 124, flexShrink: 0 }}
                    >
                        <Select
                            size="small"
                            value={selectedStatus}
                            displayEmpty
                            onChange={(event) => onStatusChange(offer.offer_id, event.target.value as OfferDecisionStatus)}
                            disabled={!canChangeStatus || offer.status === 'deleted' || (!offer.actions.accept && !offer.actions.reject)}
                            sx={{ minWidth: 124 }}
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
                                    <MenuItem
                                        key={`card-status-${offer.offer_id}-${option.value}`}
                                        value={option.value}
                                        disabled={isAcceptedBlocked || isRejectedBlocked}
                                    >
                                        {option.label}
                                    </MenuItem>
                                );
                            })}
                        </Select>
                    </Stack>
                </Stack>

                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                        <Box
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                border: `1px solid ${notificationStyle.borderColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {notificationStyle.icon}
                        </Box>
                        <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'text.primary', lineHeight: 1.15 }}>
                            {formatAmount(offer.offer_amount)}
                        </Typography>
                    </Stack>
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
                    ) : null}
                </Stack>

                <Stack direction="row" justifyContent="flex-end">
                    <ButtonBase
                        onClick={handleToggleExpand}
                        sx={{
                            px: 0.5,
                            py: 0.25,
                            borderRadius: `${theme.acomShape.controlRadius}px`,
                            color: 'text.secondary',
                            transition: 'color 0.2s ease, background-color 0.2s ease',
                            '&:hover': {
                                color: 'primary.main',
                                bgcolor: alpha(theme.palette.primary.main, 0.06)
                            }
                        }}
                    >
                        <Stack direction="row" alignItems="center" gap={0.25}>
                            <Typography sx={{ fontSize: 15, fontWeight: 500 }}>
                                {isExpanded ? 'Свернуть' : 'Подробнее'}
                            </Typography>
                            <ExpandMoreRounded
                                sx={{
                                    fontSize: 22,
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.26s ease'
                                }}
                            />
                        </Stack>
                    </ButtonBase>
                </Stack>

                <Collapse in={isExpanded} timeout={{ enter: 300, exit: 220 }} unmountOnExit>
                    <Stack divider={<Divider flexItem />}>
                        {detailRows.map((item) => (
                            <Stack key={`card-detail-${offer.offer_id}-${item.label}`} sx={{ py: 0.75 }}>
                                <Stack direction="row" alignItems="flex-start" gap={1.1} sx={{ minWidth: 0 }}>
                                    <Typography
                                        sx={{
                                            minWidth: 0,
                                            flex: '0 0 44%',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: 'text.secondary',
                                            textTransform: 'uppercase',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {item.label}
                                    </Typography>
                                    <Stack sx={{ minWidth: 0, flex: 1 }}>{item.content}</Stack>
                                </Stack>
                            </Stack>
                        ))}
                    </Stack>
                </Collapse>
            </Stack>
        </Paper>
    );
};

export const OffersTable = ({
<<<<<<< HEAD
    offers,
    statusMap,
    acceptedOfferId,
    isLoading,
    errorMessage,
    statusOptions,
    onStatusChange,
    onOpenWorkspace,
    onDownloadFile,
    canChangeStatus = true,
    onAddClick
}: OffersTableProps) => {
    const theme = useTheme();
    const [expandedCardsById, setExpandedCardsById] = useState<Record<number, boolean>>({});
    const statusContent = errorMessage ? <Typography color="error">{errorMessage}</Typography> : null;
    const notificationPalette = {
        divider: theme.palette.divider,
        text: theme.palette.text.primary
    };
    const statusFilterOptions = statusOptions.map((option) => ({ label: option.label, value: option.label }));
    const areAllCardsExpanded = offers.length > 0 && offers.every((offer) => Boolean(expandedCardsById[offer.offer_id]));

    const handleToggleOfferCardExpand = (offerId: number) => {
        setExpandedCardsById((currentState) => ({
            ...currentState,
            [offerId]: !currentState[offerId]
        }));
    };

    const handleToggleAllOfferCards = (checked: boolean) => {
        setExpandedCardsById(
            Object.fromEntries(offers.map((offer) => [offer.offer_id, checked])) as Record<number, boolean>
        );
    };
    const columns: TableTemplateColumn<RequestDetailsOffer>[] = [
        {
            id: 'status',
            header: '',
            minWidth: 56,
            width: '56px',
            align: 'center',
            sortable: false,
            renderCell: (offer) => {
                const notificationStyle = getNotificationStyle(offer.status, notificationPalette);
                return (
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
                    </Box>
                );
            }
        },
        {
            id: 'offerAmount',
            header: 'Сумма КП',
            field: 'offer_amount',
            minWidth: 150,
            renderValue: (value) => <Typography variant="body2">{formatAmount(value as number | null | undefined)}</Typography>
        },
        {
            id: 'offerId',
            header: 'Номер КП',
            field: 'offer_id',
            minWidth: 96,
            width: '110px',
            renderValue: (value) => <Typography variant="body2" fontWeight={600}>{String(value ?? '-')}</Typography>
        },
        {
            id: 'counterparty',
            header: 'Контрагент',
            minWidth: 260,
            width: '1.4fr',
            getSearchValue: (offer) => getCounterpartyInfo(offer).join(' '),
            renderCell: (offer) => {
                const counterpartyInfo = getCounterpartyInfo(offer);
                return (
                    <Stack spacing={0.5}>
                        {counterpartyInfo.map((item) => (
                            <Typography key={item} variant="body2">
                                {item}
                            </Typography>
                        ))}
                    </Stack>
                );
            }
        },
        {
            id: 'contacts',
            header: 'Контактное лицо',
            minWidth: 240,
            width: '1.2fr',
            getSearchValue: (offer) => getContactPersonInfo(offer).join(' '),
            renderCell: (offer) => {
                const contactPersonInfo = getContactPersonInfo(offer);
                return (
                    <Stack spacing={0.5}>
                        {contactPersonInfo.map((item) => (
                            <Typography key={item} variant="body2">
                                {item}
                            </Typography>
                        ))}
                    </Stack>
                );
            }
        },
        {
            id: 'createdAt',
            header: 'Дата создания',
            field: 'created_at',
            minWidth: 120,
            renderValue: (value) => <Typography variant="body2">{formatDate(value as string | null)}</Typography>
        },
        {
            id: 'updatedAt',
            header: 'Дата изменения',
            field: 'updated_at',
            minWidth: 120,
            renderValue: (value) => <Typography variant="body2">{formatDate(value as string | null)}</Typography>
        },
        {
            id: 'file',
            header: 'КП',
            field: 'files',
            minWidth: 170,
            width: '1.05fr',
            renderCell: (offer) =>
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
                                        maxWidth: 180,
                                        '& .MuiChip-label': {
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
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
                )
        },
        {
            id: 'statusSelect',
            header: 'Статус',
            minWidth: 150,
            filterKind: 'select',
            filterOptions: statusFilterOptions,
            getFilterValue: (offer) => {
                const selected = statusMap[offer.offer_id] ?? '';
                return statusOptions.find((item) => item.value === selected)?.label ?? 'Выберите';
            },
            getSearchValue: (offer) => {
                const selected = statusMap[offer.offer_id] ?? '';
                return statusOptions.find((item) => item.value === selected)?.label ?? '';
            },
            renderCell: (offer) => {
                const currentStatus = statusMap[offer.offer_id] ?? '';
                return (
                    <Select
                        size="small"
                        value={currentStatus}
                        displayEmpty
                        onChange={(event) => onStatusChange(offer.offer_id, event.target.value as OfferDecisionStatus)}
                        onClick={(event) => event.stopPropagation()}
                        disabled={!canChangeStatus || offer.status === 'deleted' || (!offer.actions.accept && !offer.actions.reject)}
                        sx={{ minWidth: 140 }}
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
                );
            }
        },
        {
            id: 'communication',
            header: 'Общение',
            minWidth: 170,
            width: '1fr',
            renderCell: (offer) => {
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
                        sx={(currentTheme) => ({
                            borderColor: currentTheme.palette.primary.main,
                            color: currentTheme.palette.primary.main,
                            fontWeight: 600,
                            backgroundColor: 'transparent'
                        })}
                    />
                );
            }
        }
    ];

    return (
        <TableTemplate
            columns={columns}
            rows={offers}
            getRowId={(offer) => offer.offer_id}
            isLoading={isLoading}
            statusContent={statusContent}
            noRowsLabel="КП пока не получены."
            searchPlaceholder="Найти КП"
            onRowClick={(offer) => onOpenWorkspace(offer.offer_id)}
            minTableWidth={1280}
            addButtonLabel="Внести КП вручную"
            onAddClick={onAddClick}
            renderCard={(offer) => (
                <OfferMobileCard
                    offer={offer}
                    selectedStatus={statusMap[offer.offer_id] ?? ''}
                    statusOptions={statusOptions}
                    acceptedOfferId={acceptedOfferId}
                    canChangeStatus={canChangeStatus}
                    onStatusChange={onStatusChange}
                    onDownloadFile={onDownloadFile}
                    onOpenWorkspace={onOpenWorkspace}
                    isExpanded={Boolean(expandedCardsById[offer.offer_id])}
                    onToggleExpand={() => handleToggleOfferCardExpand(offer.offer_id)}
                />
            )}
            cardExpansionControl={{
                checked: areAllCardsExpanded,
                onChange: handleToggleAllOfferCards,
                openLabel: 'Раскрыть все',
                closeLabel: 'Свернуть все'
            }}
            getCardPrimaryText={(offer) => offer.contractor_company_name ?? offer.contractor_full_name ?? `КП №${offer.offer_id}`}
            getCardSecondaryText={(offer) => `КП №${offer.offer_id}`}
            cardExcludedColumnIds={['status', 'statusSelect', 'communication']}
        />
=======
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
>>>>>>> 180f2411c68601989a269ce3ce348fad8f05d810
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
