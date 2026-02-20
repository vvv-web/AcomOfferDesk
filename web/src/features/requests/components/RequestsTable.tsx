import { Box, Chip, MenuItem, Select, Stack, SvgIcon, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { RequestWithOfferStats } from '@shared/api/getRequests';
import { DataTable } from '@shared/components/DataTable';

const baseColumns = [
    { key: 'id', label: 'id', minWidth: 60, fraction: 0.45 },
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

const getContractorOfferStatusMeta = (status: string) => {
    if (status === 'submitted') {
        return { label: 'на рассмотрении', color: '#2e7d32', background: '#e8f5e9' };
    }

    if (status === 'accepted') {
        return { label: 'принято', color: '#1565c0', background: '#e3f2fd' };
    }

    if (status === 'rejected') {
        return { label: 'отклонено', color: '#787878', background: '#f3f3f3' };
    }

    if (status === 'deleted') {
        return { label: 'удалено', color: '#c62828', background: '#ffebee' };
    }

    return { label: status, color: '#455a64', background: '#eceff1' };
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
                    sx={{ borderColor: '#d32f2f', color: '#d32f2f', fontWeight: 600 }}
                />
            ) : null}
            {hasUnreadMessages ? (
                <Box
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: (theme) => `1px solid ${theme.palette.primary.main}`,
                        color: 'primary.main',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'background.paper'
                    }}
                    title={getUnreadMessagesLabel(unreadMessagesCount) ?? undefined}
                >
                    <SvgIcon sx={{ fontSize: 16 }}>
                        <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" />
                    </SvgIcon>
                </Box>
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
    const columns = isContractor
        ? [...baseColumns.slice(0, -1), contractorOffersColumn, baseColumns[baseColumns.length - 1]]
        : baseColumns;

    return (
        <DataTable
            columns={columns}
            rows={requests}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="Заявки не найдены."
            onRowClick={onRowClick}
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
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => onOwnerChange?.(row, event.target.value)}
                            sx={{ minWidth: 150 }}
                        >
                            {ownerOptions.map((option) => (
                                <MenuItem key={option.id} value={option.id}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    ) : (
                        <Typography variant="body2">{row.id_user}</Typography>
                    ),
                    <Typography variant="body2">{formatDate(row.updated_at, true)}</Typography>
                ];

                if (isContractor) {
                    rowCells.push(
                        contractorOffers.length > 0 ? (
                            <Stack spacing={0.75} alignItems="flex-start">
                                {contractorOffers.map((offer) => {
                                    const statusMeta = getContractorOfferStatusMeta(offer.status);

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