import { MouseEvent as ReactMouseEvent, useState } from 'react';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { Box, ButtonBase, Chip, Collapse, Divider, Paper, Select, Stack, SvgIcon, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { RequestWithOfferStats } from '@shared/api/requests/getRequests';
import { UnavailableAwareMenuItem } from '@shared/components/UnavailableAwareMenuItem';
import { StatusPill } from '@shared/components/StatusPill';
import { TableTemplate, type TableTemplateColumn } from '@shared/components/TableTemplate';
import { NotificationBadge } from '@shared/ui/NotificationBadge';
import type { UnavailabilityPeriodInfo } from '@shared/lib/unavailability';

type OwnerOption = {
    id: string;
    label: string;
    unavailablePeriod?: UnavailabilityPeriodInfo | null;
};

type RequestsTableProps = {
    requests: RequestWithOfferStats[];
    isLoading?: boolean;
    onRowClick?: (request: RequestWithOfferStats) => void;
    onAddClick?: () => void;
    chatAlertsMap?: Record<number, number>;
    ownerOptions?: OwnerOption[];
    canEditOwner?: boolean;
    onOwnerChange?: (request: RequestWithOfferStats, ownerUserId: string) => void;
    isContractor?: boolean;
};

const requestStatusToneByValue: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
    open: 'info',
    review: 'warning',
    closed: 'success',
    canceled: 'neutral'
};

type RequestTableRow = RequestWithOfferStats & {
    __notificationLabel: string;
    __statusLabel: string;
};

const formatDate = (value: string | null, withTime = false) => {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const options: Intl.DateTimeFormatOptions = withTime
        ? {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }
        : {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };

    return new Intl.DateTimeFormat('ru-RU', options).format(date);
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

type RequestMobileCardProps = {
    row: RequestTableRow;
    canEditOwner: boolean;
    ownerOptions: OwnerOption[];
    onOwnerChange?: (request: RequestWithOfferStats, ownerUserId: string) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onOpenDetails?: (request: RequestWithOfferStats) => void;
};

const RequestMobileCard = ({
    row,
    canEditOwner,
    ownerOptions,
    onOwnerChange,
    isExpanded,
    onToggleExpand,
    onOpenDetails
}: RequestMobileCardProps) => {
    const theme = useTheme();
    const descriptionText = row.description?.trim() ? row.description : '-';
    const ownerValue = row.owner_full_name ?? row.id_user;
    const detailRows = [
        { key: 'deadline', label: 'Прием КП до', value: formatDate(row.deadline_at) },
        { key: 'created', label: 'Открыта', value: formatDate(row.created_at) },
        { key: 'closed', label: 'Закрыта', value: formatDate(row.closed_at) },
        { key: 'offer', label: 'Номер КП', value: String(row.id_offer ?? '-') },
        { key: 'owner', label: 'Ответственный', value: ownerValue }
    ];

    const handleToggleExpand = (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onToggleExpand();
    };

    return (
        <Paper
            onClick={onOpenDetails ? () => onOpenDetails(row) : undefined}
            sx={{
                p: { xs: 1.25, sm: 1.5 },
                borderRadius: `${theme.acomShape.controlRadius}px`,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                cursor: onOpenDetails ? 'pointer' : 'default',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`,
                '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: `0 6px 14px ${alpha(theme.palette.common.black, 0.08)}`
                }
            }}
        >
            <Stack spacing={1.2}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Typography
                        sx={{
                            minWidth: 0,
                            fontSize: 16,
                            fontWeight: 600,
                            color: 'text.primary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {`Заявка №${row.id}`}
                    </Typography>
                    <StatusPill
                        label={row.__statusLabel}
                        tone={requestStatusToneByValue[row.status ?? ''] ?? 'neutral'}
                    />
                </Stack>

                <Tooltip title={descriptionText} arrow placement="top-start" disableHoverListener={descriptionText.length <= 80}>
                    <Typography
                        sx={{
                            minHeight: 'calc(1.35em * 2)',
                            fontSize: 15,
                            lineHeight: 1.35,
                            color: 'text.secondary',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word'
                        }}
                    >
                        {descriptionText}
                    </Typography>
                </Tooltip>

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
                                    transition: 'transform 0.28s ease'
                                }}
                            />
                        </Stack>
                    </ButtonBase>
                </Stack>

                <Divider />

                <Collapse in={isExpanded} timeout={{ enter: 300, exit: 220 }} unmountOnExit>
                    <Stack divider={<Divider flexItem />} spacing={0}>
                        {detailRows.map((detail) => {
                            const isOwnerDetail = detail.key === 'owner';
                            return (
                                <Stack key={`${row.id}-${detail.key}`} sx={{ py: 0.85 }}>
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
                                            {detail.label}
                                        </Typography>
                                        {isOwnerDetail && canEditOwner ? (
                                            <Stack
                                                onClick={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()}
                                                onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()}
                                                sx={{ minWidth: 0, flex: 1 }}
                                            >
                                                <Select
                                                    size="small"
                                                    value={row.id_user}
                                                    renderValue={(selected) =>
                                                        ownerOptions.find((option) => option.id === selected)?.label
                                                        ?? row.owner_full_name
                                                        ?? String(selected ?? '')
                                                    }
                                                    onChange={(event) => onOwnerChange?.(row, event.target.value)}
                                                    sx={{ minWidth: 120 }}
                                                >
                                                    {ownerOptions.map((option) => (
                                                        <UnavailableAwareMenuItem
                                                            key={`card-owner-${option.id}`}
                                                            value={option.id}
                                                            label={option.label}
                                                            unavailablePeriod={option.unavailablePeriod}
                                                        />
                                                    ))}
                                                </Select>
                                            </Stack>
                                        ) : (
                                            <Typography
                                                sx={{
                                                    minWidth: 0,
                                                    flex: 1,
                                                    fontSize: 15,
                                                    color: detail.value === '-' ? 'text.secondary' : 'text.primary',
                                                    whiteSpace: 'normal',
                                                    wordBreak: 'break-word'
                                                }}
                                            >
                                                {detail.value}
                                            </Typography>
                                        )}
                                    </Stack>
                                </Stack>
                            );
                        })}
                    </Stack>
                </Collapse>

                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Box
                        sx={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            border: row.__notificationLabel === 'Есть уведомление' ? '1px solid' : '1px solid transparent',
                            borderColor: row.__notificationLabel === 'Есть уведомление' ? 'primary.main' : 'transparent',
                            color: row.__notificationLabel === 'Есть уведомление' ? 'primary.main' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        {row.__notificationLabel === 'Есть уведомление' ? (
                            <SvgIcon sx={{ fontSize: 18 }}>
                                <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" />
                            </SvgIcon>
                        ) : null}
                    </Box>
                    <Typography
                        sx={{
                            minWidth: 0,
                            fontSize: 14,
                            color: 'text.secondary',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {`обновлено ${formatDate(row.updated_at, true)}`}
                    </Typography>
                </Stack>
            </Stack>
        </Paper>
    );
};

export const RequestsTable = ({
    requests,
    isLoading,
    onRowClick,
    onAddClick,
    chatAlertsMap,
    ownerOptions = [],
    canEditOwner = false,
    onOwnerChange,
    isContractor = false
}: RequestsTableProps) => {
    const theme = useTheme();
    const submittedColor = theme.palette.success.main;
    const deletedColor = theme.palette.error.main;
    const [expandedCardsById, setExpandedCardsById] = useState<Record<number, boolean>>({});
    const rows = requests.map((request) => ({
        ...request,
        __notificationLabel: request.unread_messages_count && request.unread_messages_count > 0 ? 'Есть уведомление' : 'Нет уведомления',
        __statusLabel: request.status_label ?? request.status ?? '-'
    }));
    const areAllCardsExpanded = rows.length > 0 && rows.every((row) => Boolean(expandedCardsById[row.id]));

    const handleToggleCardExpand = (rowId: number) => {
        setExpandedCardsById((currentState) => ({
            ...currentState,
            [rowId]: !currentState[rowId]
        }));
    };

    const handleToggleAllCards = (checked: boolean) => {
        setExpandedCardsById(
            Object.fromEntries(rows.map((row) => [row.id, checked])) as Record<number, boolean>
        );
    };
    const statusFilterOptions = Array.from(
        new Set(rows.map((row) => row.__statusLabel).filter((label) => Boolean(label)))
    ).map((label) => ({ label, value: label }));

    const ownerFilterOptions = Array.from(
        new Set(rows.map((row) => row.owner_full_name ?? row.id_user))
    ).map((label) => ({ label, value: label }));

    const columns: TableTemplateColumn<RequestTableRow>[] = [
        {
            id: 'id',
            header: 'ID',
            field: 'id',
            minWidth: 60,
            width: '72px',
            align: 'center',
            getSortValue: (row) => row.id
        },
        {
            id: 'description',
            header: 'Описание',
            field: 'description',
            minWidth: 230,
            width: '1.6fr',
            renderValue: (value) => {
                const text = String(value ?? '-');
                return (
                    <Tooltip title={text} arrow placement="top-start" disableHoverListener={text.trim().length <= 80}>
                        <Typography
                            component="span"
                            sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word'
                            }}
                        >
                            {text}
                        </Typography>
                    </Tooltip>
                );
            }
        },
        {
            id: 'status',
            header: 'Статус',
            field: '__statusLabel',
            minWidth: 140,
            filterKind: 'select',
            filterOptions: statusFilterOptions,
            renderValue: (value, row) => (
                <StatusPill
                    label={String(value ?? '-')}
                    tone={requestStatusToneByValue[row.status ?? ''] ?? 'neutral'}
                />
            )
        },
        {
            id: 'deadline',
            header: 'Прием КП до',
            field: 'deadline_at',
            minWidth: 120,
            renderValue: (value) => <Typography variant="body2">{formatDate(value as string | null)}</Typography>
        },
        {
            id: 'created',
            header: 'Открыта',
            field: 'created_at',
            minWidth: 120,
            renderValue: (value) => <Typography variant="body2">{formatDate(value as string | null)}</Typography>
        },
        {
            id: 'closed',
            header: 'Закрыта',
            field: 'closed_at',
            minWidth: 120,
            renderValue: (value) => <Typography variant="body2">{formatDate(value as string | null)}</Typography>
        },
        {
            id: 'offer',
            header: 'Номер КП',
            field: 'id_offer',
            minWidth: 90,
            width: '96px',
            align: 'center',
            renderValue: (value) => <Typography variant="body2">{String(value ?? '-')}</Typography>
        },
        {
            id: 'owner',
            header: 'Ответственный',
            minWidth: 170,
            field: 'id_user',
            filterKind: 'select',
            filterOptions: ownerFilterOptions,
            getFilterValue: (row) => row.owner_full_name ?? row.id_user,
            getSearchValue: (row) => row.owner_full_name ?? row.id_user,
            renderCell: (row) =>
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
                )
        },
        {
            id: 'updated',
            header: 'Последнее обновление',
            field: 'updated_at',
            minWidth: 160,
            width: '170px',
            renderValue: (value) => <Typography variant="body2">{formatDate(value as string | null, true)}</Typography>
        }
    ];

    if (isContractor) {
        columns.push({
            id: 'contractorOffers',
            header: 'Мои отклики',
            field: 'offers',
            minWidth: 220,
            width: '1.3fr',
            renderCell: (row) => {
                const contractorOffers = row.offers ?? [];
                if (contractorOffers.length === 0) {
                    return <Typography variant="body2">-</Typography>;
                }
                return (
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
                );
            }
        });
    }

    columns.push({
        id: 'notification',
        header: 'Уведомление',
        field: '__notificationLabel',
        minWidth: 180,
        width: '1.2fr',
        filterKind: 'select',
        filterOptions: [
            { label: 'Есть уведомление', value: 'Есть уведомление' },
            { label: 'Нет уведомления', value: 'Нет уведомления' }
        ],
        renderCell: (row) => {
            if (isContractor) {
                const contractorOffers = row.offers ?? [];
                const unreadCount = contractorOffers.reduce((acc, offer) => acc + (offer.unread_messages_count ?? 0), 0);
                const unreadLabel = getUnreadMessagesLabel(unreadCount);
                return unreadLabel ? (
                    <Chip
                        label={unreadLabel}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: theme.palette.primary.main, color: theme.palette.primary.main, fontWeight: 600 }}
                    />
                ) : (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                );
            }
            return (
                <NotificationContent
                    countSubmitted={row.count_submitted ?? 0}
                    countDeleted={row.count_deleted_alert ?? 0}
                    countChatAlerts={chatAlertsMap?.[row.id] ?? row.count_chat_alert ?? 0}
                    unreadMessagesCount={row.unread_messages_count ?? 0}
                    submittedColor={submittedColor}
                    deletedColor={deletedColor}
                />
            );
        }
    });

    return (
        <TableTemplate
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            isLoading={isLoading}
            noRowsLabel="Заявки не найдены."
            onRowClick={onRowClick}
            minTableWidth={1160}
            searchPlaceholder="Найти заявку"
            addButtonLabel="Создать заявку"
            onAddClick={isContractor ? undefined : onAddClick}
            renderCard={(row) => (
                <RequestMobileCard
                    row={row}
                    canEditOwner={!isContractor && canEditOwner}
                    ownerOptions={ownerOptions}
                    onOwnerChange={onOwnerChange}
                    isExpanded={Boolean(expandedCardsById[row.id])}
                    onToggleExpand={() => handleToggleCardExpand(row.id)}
                    onOpenDetails={onRowClick}
                />
            )}
            cardExpansionControl={{
                checked: areAllCardsExpanded,
                onChange: handleToggleAllCards,
                openLabel: 'Раскрыть все',
                closeLabel: 'Свернуть все'
            }}
        />
    );
};
