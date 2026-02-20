import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { OffersTable } from '@features/requests/components/OffersTable';
import type { OfferDecisionStatus, OfferStatusOption } from '@features/requests/components/OffersTable';
import type { RequestWithOfferStats } from '@shared/api/getRequests';
import { getRequestDetails } from '@shared/api/getRequestDetails';
import type { RequestDetails, RequestDetailsFile, RequestDetailsOffer } from '@shared/api/getRequestDetails';
import { getRequestEconomists } from '@shared/api/getRequestEconomists';
import { markDeletedAlertViewed } from '@shared/api/markDeletedAlertViewed';
import { updateOfferStatus } from '@shared/api/updateOfferStatus';
import { deleteRequestFile, updateRequestDetails, uploadRequestFile } from '@shared/api/updateRequestDetails';
import { downloadFile } from '@shared/api/fileDownload';
import { hasAvailableAction } from '@shared/auth/availableActions';
import { DataTable } from '@shared/components/DataTable';

type RequestStatus = 'open' | 'review' | 'closed' | 'cancelled';

const statusOptions = [
    { value: 'open', label: 'Открыта', color: '#2e7d32' },
    { value: 'review', label: 'На рассмотрении', color: '#ed6c02' },
    { value: 'closed', label: 'Закрыта', color: '#787878ff' },
    { value: 'cancelled', label: 'Отменена', color: '#d32f2f' }
] as const;

const offerStatusOptions: OfferStatusOption[] = [
    { value: 'accepted', label: 'Принято' },
    { value: 'rejected', label: 'Отказано' }
];

const detailsColumns = [
    { key: 'label', label: 'Параметр' },
    { key: 'value', label: 'Значение' }
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

const toDateInputValue = (value: string | null) => {
    if (!value) return '';
    const [datePart] = value.split('T');
    return datePart ?? '';
};

const normalizeOfferStatus = (value: string | null): OfferDecisionStatus => {
    if (value === 'accepted' || value === 'rejected') {
        return value;
    }

    return '';
};

const getFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

const toDeadlineIso = (date: string) => `${date}T23:59:59`;

export const RequestDetailsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();
    const { session } = useAuth();
    const requestFromLocation = (location.state as { request?: RequestWithOfferStats } | null)?.request;
    const requestId = Number(id ?? requestFromLocation?.id ?? 0);

    const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);
    const [status, setStatus] = useState<RequestStatus>('open');
    const [baselineStatus, setBaselineStatus] = useState<RequestStatus>('open');
    const [deadline, setDeadline] = useState<string>('');
    const [baselineDeadline, setBaselineDeadline] = useState<string>('');
    const [ownerUserId, setOwnerUserId] = useState<string>('');
    const [baselineOwnerUserId, setBaselineOwnerUserId] = useState<string>('');
    const [ownerOptions, setOwnerOptions] = useState<Array<{ id: string; label: string }>>([]);
    const [existingFiles, setExistingFiles] = useState<RequestDetailsFile[]>([]);
    const [deletedFileIds, setDeletedFileIds] = useState<number[]>([]);
    const [newFile, setNewFile] = useState<File | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isClearingDeletedAlert, setIsClearingDeletedAlert] = useState(false);

    const [offers, setOffers] = useState<RequestDetailsOffer[]>([]);
    const [offersStatusMap, setOffersStatusMap] = useState<Record<number, OfferDecisionStatus>>({});
    const [offersLoading, setOffersLoading] = useState(false);
    const [offersError, setOffersError] = useState<string | null>(null);
    const pollIntervalMs = 10000;

    const statusConfig = useMemo(
        () => statusOptions.find((option) => option.value === status) ?? statusOptions[0],
        [status]
    );
    const hasDeletedAlert = (requestDetails?.count_deleted_alert ?? 0) > 0;
    const hasFileChanges = deletedFileIds.length > 0 || Boolean(newFile);
    const hasPendingChanges =
        status !== baselineStatus ||
        deadline !== baselineDeadline ||
        ownerUserId !== baselineOwnerUserId ||
        hasFileChanges;
    const canEditRequest = useMemo(
        () =>
            hasAvailableAction(
                { availableActions: requestDetails?.availableActions ?? [] },
                `/api/v1/requests/${requestId}`,
                'PATCH'
            ),
        [requestDetails?.availableActions, requestId]
    );
    const canEditOwner = useMemo(
        () => canEditRequest && (session?.roleId === 1 || session?.roleId === 3),
        [canEditRequest, session?.roleId]
    );

    const todayDate = useMemo(() => {
        const now = new Date();
        const offsetMs = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offsetMs).toISOString().split('T')[0];
    }, []);

    const syncRequestState = useCallback((nextRequest: RequestDetails, forceBaseline: boolean) => {
        setRequestDetails(nextRequest);
        setOffers(nextRequest.offers ?? []);
        setOffersStatusMap(
            (nextRequest.offers ?? []).reduce<Record<number, OfferDecisionStatus>>((acc, offer) => {
                acc[offer.offer_id] = normalizeOfferStatus(offer.status);
                return acc;
            }, {})
        );

        if (forceBaseline) {
            const nextStatus = (statusOptions.find((o) => o.value === nextRequest.status)?.value ?? 'open') as RequestStatus;
            const nextDeadline = toDateInputValue(nextRequest.deadline_at);
            const nextOwner = nextRequest.id_user ?? '';
            setStatus(nextStatus);
            setBaselineStatus(nextStatus);
            setDeadline(nextDeadline);
            setBaselineDeadline(nextDeadline);
            setOwnerUserId(nextOwner);
            setBaselineOwnerUserId(nextOwner);
            setExistingFiles(nextRequest.files ?? []);
            setDeletedFileIds([]);
            setNewFile(null);
        }
    }, []);

    const fetchRequest = useCallback(
        async (showLoading: boolean) => {
            if (!Number.isFinite(requestId) || requestId <= 0) {
                return;
            }
            if (showLoading) {
                setOffersLoading(true);
            }
            try {
                const nextRequest = await getRequestDetails(requestId);
                const hasLocalChanges =
                    status !== baselineStatus ||
                    deadline !== baselineDeadline ||
                    ownerUserId !== baselineOwnerUserId ||
                    hasFileChanges;
                syncRequestState(nextRequest, !hasLocalChanges);
                setOffersError(null);
            } catch (error) {
                setOffersError(error instanceof Error ? error.message : 'Не удалось загрузить заявку');
            } finally {
                if (showLoading) {
                    setOffersLoading(false);
                }
            }
        },
        [
            baselineDeadline,
            baselineOwnerUserId,
            baselineStatus,
            deadline,
            hasFileChanges,
            ownerUserId,
            requestId,
            status,
            syncRequestState
        ]
    );

    const fetchOwners = useCallback(async () => {
        if (!canEditOwner) {
            setOwnerOptions([]);
            return;
        }

        try {
            const economists = await getRequestEconomists();
            setOwnerOptions(
                economists.map((item) => ({
                    id: item.user_id,
                    label: `${item.full_name?.trim() || item.user_id} (${item.role})`
                }))
            );
        } catch {
            setOwnerOptions([]);
        }
    }, [canEditOwner]);


    useEffect(() => {
        void fetchRequest(true);
        const intervalId = window.setInterval(() => {
            void fetchRequest(false);
        }, pollIntervalMs);
        return () => window.clearInterval(intervalId);
    }, [fetchRequest]);

    useEffect(() => {
        void fetchOwners();
    }, [fetchOwners]);

     const getSaveValidationError = (currentStatus: RequestStatus, currentDeadline: string) => {
        const statusChanged = currentStatus !== baselineStatus;
        const ownerChanged = ownerUserId !== baselineOwnerUserId;
        const isReopen = statusChanged && baselineStatus !== 'open' && currentStatus === 'open';
        const deadlineChanged = currentDeadline !== baselineDeadline;

        if (!statusChanged && !deadlineChanged && !ownerChanged && !hasFileChanges) {
            return 'Нет изменений для сохранения';
        }

        if ((deadlineChanged || isReopen) && !currentDeadline) {
            return 'При повторном открытии заявки необходимо установить дедлайн';
        }

        if (currentDeadline && currentDeadline < todayDate) {
            return 'Дедлайн не может быть раньше текущей даты';
        }

        if (deadlineChanged && currentStatus !== 'open' && currentStatus !== 'review') {
            return 'Для изменения дедлайна заявку необходимо повторно открыть';
        }

        if (currentStatus === 'closed') {
            const hasAcceptedOffer = offers.some((offer) => offer.status === 'accepted');
            if (!hasAcceptedOffer) {
                return 'Нельзя закрыть заявку без оффера со статусом "Принят"';
            }
        }

        if (ownerChanged && !canEditOwner) {
            return 'Изменение ответственного доступно только суперадмину и ведущему экономисту';
        }

        if (ownerChanged && ownerUserId && !ownerOptions.some((option) => option.id === ownerUserId)) {
            return 'Назначить ответственным можно только ведущего экономиста или экономиста';
        }

        return null;
    };

    const effectiveDeadlineForValidation = status === 'review' ? todayDate : deadline;
    const saveValidationError = getSaveValidationError(status, effectiveDeadlineForValidation);

    const handleSave = async () => {
        const currentRequest = requestDetails;
        if (!currentRequest || !canEditRequest) {
            return;
        }

        const statusChanged = status !== baselineStatus;
        const ownerChanged = ownerUserId !== baselineOwnerUserId;
        let effectiveDeadline = deadline;
        if (status === 'review') {
            effectiveDeadline = todayDate;
        }
        const deadlineChanged = effectiveDeadline !== baselineDeadline;

        const validationError = getSaveValidationError(status, effectiveDeadline);
        if (validationError) {
            setErrorMessage(validationError);
            setSuccessMessage(null);
            return;
        }
        setIsSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            await updateRequestDetails({
                requestId: currentRequest.id,
                status: statusChanged ? status : undefined,
                deadline_at: deadlineChanged ? toDeadlineIso(effectiveDeadline) : undefined,
                owner_user_id: ownerChanged ? ownerUserId : undefined
            });

            await Promise.all(deletedFileIds.map((fileId) => deleteRequestFile(currentRequest.id, fileId)));
            if (newFile) {
                await uploadRequestFile(currentRequest.id, newFile);
            }

            const refreshed = await getRequestDetails(currentRequest.id);
            syncRequestState(refreshed, true);
            setSuccessMessage('Изменения сохранены');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить изменения');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOfferStatusChange = async (offerId: number, value: OfferDecisionStatus) => {
        const previousStatus = offersStatusMap[offerId] ?? '';

        setOffersStatusMap((prev) => ({
            ...prev,
            [offerId]: value
        }));

        if (!value) {
            return;
        }

        const confirmMessage =
            value === 'accepted'
                ? 'Если принять этот оффер, остальные офферы по заявке автоматически получат статус «Отказано». Продолжить?'
                : 'Вы уверены, что хотите изменить статус оффера на «Отказано»?';

        const isConfirmed = window.confirm(confirmMessage);

        if (!isConfirmed) {
            setOffersStatusMap((prev) => ({
                ...prev,
                [offerId]: previousStatus
            }));
            return;
        }

        try {
            const response = await updateOfferStatus({
                offer_id: offerId,
                status: value
            });
            setOffers((prev) =>
                prev.map((offer) =>
                    offer.offer_id === offerId
                        ? { ...offer, status: response.offer.status }
                        : offer
                )
            );
            setOffersStatusMap((prev) => ({
                ...prev,
                [offerId]: normalizeOfferStatus(response.offer.status)
            }));
        } catch (error) {
            setOffersStatusMap((prev) => ({
                ...prev,
                [offerId]: previousStatus
            }));
            setOffersError(error instanceof Error ? error.message : 'Не удалось обновить статус оффера');
        }
    };


    const handleDeletedAlertViewed = async () => {
        if (!hasDeletedAlert || !requestDetails) {
            return;
        }

        setIsClearingDeletedAlert(true);
        setErrorMessage(null);
        try {
            const response = await markDeletedAlertViewed({
                request_id: requestDetails.id
            });
            setRequestDetails((prev) => {
                if (!prev) {
                    return prev;
                }
                return {
                    ...prev,
                    count_deleted_alert: response.request_offer_stats.count_deleted_alert,
                    updated_at: response.request_offer_stats.updated_at ?? prev.updated_at
                };
            });
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Не удалось отметить уведомление');
        } finally {
            setIsClearingDeletedAlert(false);
        }
    };

    const handleDownload = async (downloadUrl: string, fileName: string) => {
        try {
            await downloadFile(downloadUrl, fileName);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Не удалось скачать файл');
        }
    };

    const handleRemoveExistingFile = (fileId: number) => {
        setExistingFiles((prev) => prev.filter((file) => file.id !== fileId));
        setDeletedFileIds((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
    };


    const detailsRows = [
        {
            id: 'owner',
            label: 'Ответственный',
            value: canEditOwner ? (
                <Select
                    size="small"
                    value={ownerUserId}
                    onChange={(event) => setOwnerUserId(event.target.value)}
                    sx={{ minWidth: 200 }}
                >
                    {ownerOptions.map((option) => (
                        <MenuItem key={option.id} value={option.id}>
                            {option.label}
                        </MenuItem>
                    ))}
                </Select>
            ) : (requestDetails?.id_user ?? '-')
        },
        { id: 'created', label: 'Создана', value: formatDate(requestDetails?.created_at ?? null) },
        { id: 'closed', label: 'Закрыта', value: formatDate(requestDetails?.closed_at ?? null) },
        { id: 'offer', label: 'Номер КП', value: requestDetails?.id_offer ?? '-' },
        {
            id: 'deadline',
            label: 'Дедлайн сбора КП',
            value: (
                <TextField
                    type="date"
                    size="small"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    inputProps={{ min: todayDate }}
                    disabled={!canEditRequest}
                    sx={{ minWidth: 150 }}
                />
            )
        },
        { id: 'updated', label: 'Последнее изменение', value: formatDate(requestDetails?.updated_at ?? null) }
    ];

    useEffect(() => {
        if (!hasPendingChanges) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasPendingChanges]);

    if (!requestDetails) {
        return (
            <Box>
                <Typography variant="h6" mb={2}>
                    Нет данных для отображения заявки.
                </Typography>
                <Button variant="outlined" onClick={() => navigate('/requests')}>
                    Вернуться к заявкам
                </Button>
            </Box>
        );
    }

    return (
        <Box>
            <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                flexWrap="wrap"
                sx={{ mb: 3 }}
            >
                <Typography variant="h6" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
                    Номер заявки: {requestDetails.id}
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
                        value={status}
                        onChange={(event) => {
                            const nextStatus = event.target.value as RequestStatus;
                            if (nextStatus !== status) {
                                const isConfirmed = window.confirm(
                                    `Вы уверены, что хотите изменить статус заявки на «${statusOptions.find((option) => option.value === nextStatus)?.label ?? nextStatus}»?`
                                );
                                if (!isConfirmed) {
                                    return;
                                }
                            }
                            setStatus(nextStatus);
                            if (nextStatus === 'review') {
                                setDeadline(todayDate);
                            }
                        }}
                        disabled={!canEditRequest}
                        sx={{
                            minWidth: 200,
                            borderRadius: 999,
                            backgroundColor: 'background.paper'
                        }}
                    >
                        {statusOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                </Stack>
                <Button
                    variant="contained"
                    sx={{ paddingX: 4, boxShadow: 'none', whiteSpace: 'nowrap', '&:hover': { boxShadow: 'none' } }}
                    onClick={() => void handleSave()}
                    disabled={isSaving || !canEditRequest || !hasPendingChanges || Boolean(saveValidationError)}
                >
                    {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                </Button>
            </Stack>
            {hasPendingChanges && (
                <Typography color="warning.main" sx={{ mb: 2 }}>
                    Есть несохраненные изменения. При уходе со страницы они будут потеряны.
                </Typography>
            )}
            {errorMessage && (
                <Typography color="error" sx={{ mb: 2 }}>
                    {errorMessage}
                </Typography>
            )}
            {successMessage && (
                <Typography color="success.main" sx={{ mb: 2 }}>
                    {successMessage}
                </Typography>
            )}

            <Box
                sx={(theme) => ({
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    padding: { xs: 2, md: 3 },
                    display: 'grid',
                    gap: 3,
                    gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }
                })}
            >
                <Stack spacing={2}>
                    <TextField
                        value={requestDetails.description ?? ''}
                        placeholder="Описание заявки"
                        multiline
                        minRows={6}
                        InputProps={{ readOnly: true }}
                        sx={{ borderRadius: 3 }}
                    />
                    <Stack spacing={1}>
                        <Typography variant="subtitle2" color="text.secondary">
                            Файлы заявки
                        </Typography>
                        {existingFiles.length > 0 ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {existingFiles.map((file) => (
                                    <Chip
                                        key={file.id}
                                        label={file.name}
                                        variant="outlined"
                                        onClick={() => void handleDownload(file.download_url, file.name)}
                                        onDelete={canEditRequest ? () => handleRemoveExistingFile(file.id) : undefined}
                                    />
                                ))}
                            </Box>
                        ) : (
                            <Typography variant="body2">Файлы не прикреплены</Typography>
                        )}

                        {canEditRequest && (
                            <>
                                <Button variant="outlined" component="label" sx={{ width: 'fit-content' }}>
                                    Прикрепить новые файлы
                                    <input
                                        hidden
                                        type="file"
                                        onChange={(event) => {
                                            setNewFile(event.target.files?.[0] ?? null);
                                            event.target.value = '';
                                        }}
                                    />
                                </Button>
                                {newFile && (
                                    <Chip
                                        key={getFileKey(newFile)}
                                        label={newFile.name}
                                        variant="outlined"
                                        onDelete={() => setNewFile(null)}
                                    />
                                )}
                            </>
                        )}
                    </Stack>
                    {hasDeletedAlert && (
                        <Button
                            variant="contained"
                            sx={(theme) => ({
                                paddingX: 3,
                                width: 'fit-content',
                                backgroundColor: theme.palette.error.main,
                                color: theme.palette.error.contrastText,
                                boxShadow: 'none',
                                '&:hover': { backgroundColor: theme.palette.error.dark, boxShadow: 'none' },
                                '&:disabled': {
                                    backgroundColor: theme.palette.error.light,
                                    color: theme.palette.error.contrastText
                                }
                            })}
                            onClick={() => void handleDeletedAlertViewed()}
                            disabled={isClearingDeletedAlert}
                        >
                            {isClearingDeletedAlert ? 'Отмечаем...' : 'Уведомлен об отмене сделки'}
                        </Button>

                    )}
                </Stack>
                <DataTable
                    columns={detailsColumns}
                    rows={detailsRows}
                    rowKey={(row) => row.id}
                    showHeader={false}
                    enableColumnControls={false}
                    renderRow={(row) => [
                        <Typography variant="body2">{row.label}</Typography>,
                        typeof row.value === 'string' || typeof row.value === 'number' ? (
                            <Typography variant="body2">{row.value}</Typography>
                        ) : (
                            row.value
                        )
                    ]}
                />

            </Box>
            <Box sx={{ marginTop: 4 }}>
                <OffersTable
                    offers={offers}
                    statusMap={offersStatusMap}
                    isLoading={offersLoading}
                    errorMessage={offersError}
                    statusOptions={offerStatusOptions}
                    onStatusChange={(offerId, value) => void handleOfferStatusChange(offerId, value)}
                    onOpenWorkspace={(offerId) => navigate(`/offers/${offerId}/workspace`)}
                    onDownloadFile={(downloadUrl, fileName) => void handleDownload(downloadUrl, fileName)}
                />
            </Box>
        </Box>
    );
};