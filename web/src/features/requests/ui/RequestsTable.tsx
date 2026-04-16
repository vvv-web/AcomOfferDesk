import { MouseEvent as ReactMouseEvent, useMemo, useState } from 'react';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { ButtonBase, Chip, Divider, Paper, Select, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { RequestWithOfferStats } from '@shared/api/requests/getRequests';
import { UnavailableAwareMenuItem } from '@shared/components/UnavailableAwareMenuItem';
import { DataTable } from '@shared/components/DataTable';
import { formatDate } from '@shared/lib/formatters';
import { NotificationBadge } from '@shared/ui/NotificationBadge';
import type { UnavailabilityPeriodInfo } from '@shared/lib/unavailability';

const baseColumns = [
    { key: 'id', label: 'ID', minWidth: 60, fraction: 0.45 },
    { key: 'description', label: 'Описание', minWidth: 200, fraction: 2.5 },

    { key: 'status', label: 'Статус', minWidth: 100, fraction: 1.1 },
    { key: 'deadline', label: 'Прием КП до', minWidth: 120, fraction: 1.1 },
    { key: 'created', label: 'Открыта', minWidth: 120, fraction: 1.1 },
    { key: 'closed', label: 'Закрыта', minWidth: 120, fraction: 1.1 },

    { key: 'offer', label: 'Номер КП', minWidth: 100, fraction: 0.9 },
    { key: 'owner', label: 'Ответственный', minWidth: 160, fraction: 1.2 },

    { key: 'updated', label: 'Последнее обновление', minWidth: 150, fraction: 1.3 },
    { key: 'notification', label: 'Уведомление', minWidth: 180, fraction: 1.6 }
];

const contractorOffersColumn = { key: 'contractorOffers', label: 'Мои отклики', minWidth: 200, fraction: 1.8 };

type OwnerOption = {
    id: string;
    label: string;
    unavailablePeriod?: UnavailabilityPeriodInfo | null;
};

type RequestsTableProps = {
    requests: RequestWithOfferStats[];
    isLoading?: boolean;
    onRowClick?: (request: RequestWithOfferStats) => void;
    chatAlertsMap?: Record<number, number>;
    ownerOptions?: OwnerOption[];
    canEditOwner?: boolean;
    onOwnerChange?: (request: RequestWithOfferStats, ownerUserId: string) => void;
    isContractor?: boolean;
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
    submitted: 'success',
    accepted: 'info',
    rejected: 'neutral',
    deleted: 'error',
};

const offerStatusLabelMap: Record<string, string> = {
    submitted: 'на рассмотрении',
    accepted: 'принято',
    rejected: 'отклонено',
    deleted: 'удалено',
};

const getContractorOfferStatusMeta = (status: string, tones: import('@mui/material/styles').StatusTones) => {
    const toneKey = offerStatusToneKey[status] ?? 'neutral';
    const tone = tones[toneKey];
    return { label: offerStatusLabelMap[status] ?? status, color: tone.text, background: tone.bg };
};

const NotificationContent = ({
    countSubmitted,
    countDeleted,
    countChatAlerts,
    unreadMessagesCount,
    submittedColor,
    deletedColor
}: {
    countSubmitted: number;
    countDeleted: number;
    countChatAlerts: number;
    unreadMessagesCount: number;
    submittedColor: string;
    deletedColor: string;
}) => {
    const hasUnreadMessages = unreadMessagesCount > 0;

    if (countSubmitted <= 0 && countDeleted <= 0 && countChatAlerts <= 0 && !hasUnreadMessages) {
        return null;
    }

    return (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {countSubmitted > 0 ? (
                <Chip
                    label={countSubmitted === 1 ? 'Новое предложение' : `${countSubmitted} новых предложения`}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: submittedColor, color: submittedColor, fontWeight: 600 }}
                />
            ) : null}
            {countDeleted > 0 ? (
                <Chip
                    label={countDeleted === 1 ? 'Отмена сделки' : `${countDeleted} отмены сделки`}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: deletedColor, color: deletedColor, fontWeight: 600 }}
                />
            ) : null}
            {countChatAlerts > 0 ? (
                <Chip
                    label="Новый ответ"
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: 'error.main', color: 'error.main', fontWeight: 600 }}
                />
            ) : null}
            {hasUnreadMessages ? (
                <NotificationBadge title={getUnreadMessagesLabel(unreadMessagesCount) ?? undefined} />
            ) : null}
        </Stack>
    );
};

export const RequestsTable = ({
    requests,
    isLoading,
    onRowClick,
    chatAlertsMap,
    ownerOptions = [],
    canEditOwner = false,
    onOwnerChange,
    isContractor = false
}: RequestsTableProps) => {
    const theme = useTheme();
    const submittedColor = theme.palette.success.main;
    const deletedColor = theme.palette.error.main;
  const [expandedCardsByRequestId, setExpandedCardsByRequestId] = useState<Record<number, boolean>>({});
    const columns = isContractor
        ? [...baseColumns.slice(0, -1), contractorOffersColumn, baseColumns[baseColumns.length - 1]]
        : baseColumns;
  const areAllCardsExpanded = useMemo(
    () => requests.length > 0 && requests.every((request) => expandedCardsByRequestId[request.id]),
    [expandedCardsByRequestId, requests]
  );

  const handleToggleSingleCard = (requestId: number) => {
    setExpandedCardsByRequestId((currentState) => ({
      ...currentState,
      [requestId]: !currentState[requestId]
    }));
  };

  const handleToggleAllCards = (shouldExpand: boolean) => {
    if (!shouldExpand) {
      setExpandedCardsByRequestId({});
      return;
    }

    setExpandedCardsByRequestId(
      Object.fromEntries(requests.map((request) => [request.id, true])) as Record<number, boolean>
    );
  };

    return (
        <DataTable
            columns={columns}
            rows={requests}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="Заявки не найдены."
            onRowClick={onRowClick}
            cardExpansionControl={{
                checked: areAllCardsExpanded,
                onChange: handleToggleAllCards,
                openLabel: 'Раскрыть все',
                closeLabel: 'Свернуть все'
            }}
            renderCard={(row) => {
                const contractorOffers = row.offers ?? [];
                const contractorUnreadMessagesCount = contractorOffers.reduce(
                    (acc, offer) => acc + (offer.unread_messages_count ?? 0),
                    0
                );
                const isExpanded = Boolean(expandedCardsByRequestId[row.id]);
                const notificationContent = isContractor ? (
                    getUnreadMessagesLabel(contractorUnreadMessagesCount) ? (
                        <Chip
                            label={getUnreadMessagesLabel(contractorUnreadMessagesCount)}
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: theme.palette.primary.main, color: theme.palette.primary.main, fontWeight: 600 }}
                        />
                    ) : (
                        <Typography variant="body2" color="text.secondary">Без новых сообщений</Typography>
                    )
                ) : (
                    <NotificationContent
                        countSubmitted={row.count_submitted ?? 0}
                        countDeleted={row.count_deleted_alert ?? 0}
                        countChatAlerts={chatAlertsMap?.[row.id] ?? row.count_chat_alert ?? 0}
                        unreadMessagesCount={row.unread_messages_count ?? 0}
                        submittedColor={submittedColor}
                        deletedColor={deletedColor}
                    />
                );

                const handleToggleExpand = (event: ReactMouseEvent<HTMLButtonElement>) => {
                    event.stopPropagation();
                    handleToggleSingleCard(row.id);
                };

                return (
                    <Paper
                        onClick={() => onRowClick?.(row)}
                        sx={{
                            p: { xs: 1.25, sm: 1.5 },
                            borderRadius: `${theme.acomShape.controlRadius}px`,
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            cursor: onRowClick ? 'pointer' : 'default',
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
                                <Stack sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>
                                        {`Заявка №${row.id}`}
                                    </Typography>
                                    <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                                        {row.status_label ?? row.status ?? '-'}
                                    </Typography>
                                </Stack>
                                <Typography sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }}>
                                    {formatDate(row.updated_at, true)}
                                </Typography>
                            </Stack>

                            <Typography
                                sx={{
                                    minHeight: 'calc(1.35em * 2)',
                                    fontSize: 15,
                                    color: 'text.secondary',
                                    display: '-webkit-box',
                                    WebkitBoxOrient: 'vertical',
                                    WebkitLineClamp: isExpanded ? 'unset' : 2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: isExpanded ? 'normal' : 'initial',
                                    wordBreak: 'break-word'
                                }}
                            >
                                {row.description ?? '-'}
                            </Typography>

                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                                    {`КП: ${row.id_offer ?? '-'}`}
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
                                    <Stack spacing={0.75}>
                                        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                                            {`Прием КП до: ${formatDate(row.deadline_at)}`}
                                        </Typography>
                                        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                                            {`Открыта: ${formatDate(row.created_at)}`}
                                        </Typography>
                                        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                                            {`Закрыта: ${formatDate(row.closed_at)}`}
                                        </Typography>
                                        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                                            {`Ответственный: ${row.owner_full_name ?? row.id_user}`}
                                        </Typography>
                                    </Stack>
                                </>
                            )}

                            <Divider />
                            <Stack sx={{ minHeight: 28, justifyContent: 'center' }}>
                                {notificationContent}
                            </Stack>
                        </Stack>
                    </Paper>
                );
            }}
            rowHoverOutlineColor={alpha(theme.palette.primary.main, 0.45)}
            storageKey="requests-table"
            renderRow={(row) => {
                const contractorOffers = row.offers ?? [];
                const contractorUnreadMessagesCount = contractorOffers.reduce(
                    (acc, offer) => acc + (offer.unread_messages_count ?? 0),
                    0
                );

                const rowCells = [
                    <Typography variant="body2">{row.id}</Typography>,
                    <Typography variant="body2">{row.description ?? '-'}</Typography>,
                    <Typography variant="body2">{row.status_label ?? row.status ?? '-'}</Typography>,
                    <Typography variant="body2">{formatDate(row.deadline_at)}</Typography>,
                    <Typography variant="body2">{formatDate(row.created_at)}</Typography>,
                    <Typography variant="body2">{formatDate(row.closed_at)}</Typography>,
                    <Typography variant="body2">{row.id_offer ?? '-'}</Typography>,
                    canEditOwner ? (
                        <Select
                            size="small"
                            value={row.id_user}
                            renderValue={(selected) => ownerOptions.find((option) => option.id === selected)?.label ?? row.owner_full_name ?? String(selected ?? '')}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => onOwnerChange?.(row, event.target.value)}
                            sx={{ minWidth: 150 }}
                        >
                            {ownerOptions.map((option) => (
                                <UnavailableAwareMenuItem
                                    key={option.id}
                                    value={option.id}
                                    label={option.label}
                                    unavailablePeriod={option.unavailablePeriod}
                                />
                            ))}
                        </Select>
                    ) : (
                        <Typography variant="body2">{row.owner_full_name ?? row.id_user}</Typography>
                    ),
                    <Typography variant="body2">{formatDate(row.updated_at, true)}</Typography>
                ];

                if (isContractor) {
                    rowCells.push(
                        contractorOffers.length > 0 ? (
                            <Stack spacing={0.75} alignItems="flex-start">
                                {contractorOffers.map((offer) => {
                                    const statusMeta = getContractorOfferStatusMeta(offer.status, theme.palette.statusTones);

                                    return (
                                        <Chip
                                            key={offer.id}
                                            size="small"
                                            label={`КП № ${offer.id} ${statusMeta.label}`}
                                            sx={{
                                                borderRadius: 999,
                                                border: `1px solid ${statusMeta.color}`,
                                                color: statusMeta.color,
                                                backgroundColor: statusMeta.background,
                                                fontWeight: 500,
                                                '& .MuiChip-label': {
                                                    px: 1.25
                                                }
                                            }}
                                        />
                                    );
                                })}
                            </Stack>
                        ) : (
                            <Typography variant="body2">-</Typography>
                        )
                    );
                }

                rowCells.push(
                    isContractor ? (
                        getUnreadMessagesLabel(contractorUnreadMessagesCount) ? (
                            <Chip
                                label={getUnreadMessagesLabel(contractorUnreadMessagesCount)}
                                size="small"
                                variant="outlined"
                                sx={{ borderColor: theme.palette.primary.main, color: theme.palette.primary.main, fontWeight: 600 }}
                            />
                        ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                        )
                    ) : (
                        <NotificationContent
                            countSubmitted={row.count_submitted ?? 0}
                            countDeleted={row.count_deleted_alert ?? 0}
                            countChatAlerts={chatAlertsMap?.[row.id] ?? row.count_chat_alert ?? 0}
                            unreadMessagesCount={row.unread_messages_count ?? 0}
                            submittedColor={submittedColor}
                            deletedColor={deletedColor}
                        />
                    )
                );

                return rowCells;
            }}
        />
    );
};
