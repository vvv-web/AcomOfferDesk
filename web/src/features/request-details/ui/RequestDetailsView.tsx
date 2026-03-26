import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import { OffersTable } from './OffersTable';
import type { OfferDecisionStatus, OfferStatusOption } from './OffersTable';
import { getRequestDetails } from '@shared/api/requests/getRequestDetails';
import type { RequestDetails, RequestDetailsFile, RequestDetailsOffer } from '@shared/api/requests/getRequestDetails';
import { getRequestEconomists } from '@shared/api/requests/getRequestEconomists';
import { sendRequestEmailNotifications } from '@shared/api/requests/sendRequestEmailNotifications';
import { markDeletedAlertViewed } from '@shared/api/offers/markDeletedAlertViewed';
import { updateOfferStatus } from '@shared/api/offers/updateOfferStatus';
import { deleteRequestFile, updateRequestDetails, uploadRequestFile } from '@shared/api/requests/updateRequestDetails';
import { downloadFile } from '@shared/api/fileDownload';
import { AdditionalEmailsField, type AdditionalEmailsFieldHandle } from '@shared/components/AdditionalEmailsField';
import { UnavailableAwareMenuItem } from '@shared/components/UnavailableAwareMenuItem';
import { DataTable } from '@shared/components/DataTable';
import { ToggleSection } from '@shared/components/ToggleSection';
import { getFileKey } from '@shared/lib/files';
import { formatUnavailabilityDate, type UnavailabilityPeriodInfo } from '@shared/lib/unavailability';
import { useRequestDetails } from '../model/useRequestDetails';

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

const toAmountInputValue = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '';
    }

    return String(value);
};

const parseAmountInput = (value: string) => {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const normalizeOfferStatus = (value: string | null): OfferDecisionStatus => {
    if (value === 'accepted' || value === 'rejected') {
        return value;
    }

    return '';
};

const buildRequestDetailsSignature = (request: RequestDetails | null) => {
    if (!request) {
        return '';
    }

    return JSON.stringify({
        id: request.id,
        id_user: request.id_user,
        status: request.status,
        deadline_at: request.deadline_at,
        updated_at: request.updated_at,
        initial_amount: request.initial_amount,
        final_amount: request.final_amount,
        id_offer: request.id_offer,
        count_deleted_alert: request.count_deleted_alert,
        offers: request.offers.map((offer) => ({
            id: offer.offer_id,
            status: offer.status,
            updated_at: offer.updated_at,
            amount: offer.offer_amount,
            unread_messages_count: offer.unread_messages_count ?? 0,
            files: offer.files.map((file) => [file.id, file.name])
        })),
        files: request.files.map((file) => [file.id, file.name])
    });
};

const toDeadlineIso = (date: string) => `${date}T23:59:59`;

export const RequestDetailsView = () => {
    const { navigate, requestId } = useRequestDetails();

    const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);
    const [status, setStatus] = useState<RequestStatus>('open');
    const [baselineStatus, setBaselineStatus] = useState<RequestStatus>('open');
    const [deadline, setDeadline] = useState<string>('');
    const [baselineDeadline, setBaselineDeadline] = useState<string>('');
    const [ownerUserId, setOwnerUserId] = useState<string>('');
    const [baselineOwnerUserId, setBaselineOwnerUserId] = useState<string>('');
    const [initialAmount, setInitialAmount] = useState<string>('');
    const [baselineInitialAmount, setBaselineInitialAmount] = useState<string>('');
    const [finalAmount, setFinalAmount] = useState<string>('');
    const [baselineFinalAmount, setBaselineFinalAmount] = useState<string>('');
    const [ownerOptions, setOwnerOptions] = useState<Array<{ id: string; label: string; unavailablePeriod: UnavailabilityPeriodInfo | null }>>([]);
    const [existingFiles, setExistingFiles] = useState<RequestDetailsFile[]>([]);
    const [deletedFileIds, setDeletedFileIds] = useState<number[]>([]);
    const [newFile, setNewFile] = useState<File | null>(null);
    const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
    const [additionalEmailsEnabled, setAdditionalEmailsEnabled] = useState(false);
    const additionalEmailsFieldRef = useRef<AdditionalEmailsFieldHandle | null>(null);
    const requestSignatureRef = useRef('');
    const hasPendingChangesRef = useRef(false);

    const [isSaving, setIsSaving] = useState(false);
    const [isSendingEmails, setIsSendingEmails] = useState(false);
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
    const canViewRequestAmounts = useMemo(
        () => Boolean(requestDetails?.actions.view_amounts),
        [requestDetails?.actions.view_amounts]
    );
    const hasRequestFieldChanges =
        status !== baselineStatus ||
        deadline !== baselineDeadline ||
        (canViewRequestAmounts && initialAmount !== baselineInitialAmount) ||
        (canViewRequestAmounts && finalAmount !== baselineFinalAmount);
    const hasOwnerChange = ownerUserId !== baselineOwnerUserId;
    const hasPendingChanges = hasRequestFieldChanges || hasOwnerChange || hasFileChanges;

    useEffect(() => {
        hasPendingChangesRef.current = hasPendingChanges;
    }, [hasPendingChanges]);

    const canEditRequest = useMemo(() => Boolean(requestDetails?.actions.edit), [requestDetails?.actions.edit]);
    const canEditOwner = useMemo(
        () => Boolean(requestDetails?.actions.change_owner),
        [requestDetails?.actions.change_owner]
    );

    const canChangeOfferStatus = useMemo(
        () => (requestDetails?.offers ?? []).some((offer) => offer.actions.accept || offer.actions.reject),
        [requestDetails?.offers]
    );
    const canSendAdditionalEmails = useMemo(
        () => status === 'open' && Boolean(requestDetails?.actions.send_email_notifications),
        [requestDetails?.actions.send_email_notifications, status]
    );
    const isAdditionalEmailsFieldUnavailable = !canSendAdditionalEmails || isSendingEmails;
    const canUploadRequestFiles = useMemo(() => Boolean(requestDetails?.actions.upload_file), [requestDetails?.actions.upload_file]);
    const canDeleteRequestFiles = useMemo(() => Boolean(requestDetails?.actions.delete_file), [requestDetails?.actions.delete_file]);
    const canMarkDeletedAlertViewed = useMemo(
        () => Boolean(requestDetails?.actions.mark_deleted_alert_viewed),
        [requestDetails?.actions.mark_deleted_alert_viewed]
    );
    const canSaveRequestChanges =
        (hasRequestFieldChanges && canEditRequest)
        || (hasOwnerChange && canEditOwner)
        || (deletedFileIds.length > 0 && canDeleteRequestFiles)
        || (Boolean(newFile) && canUploadRequestFiles);

    const todayDate = useMemo(() => {
        const now = new Date();
        const offsetMs = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offsetMs).toISOString().split('T')[0];
    }, []);

    const syncRequestState = useCallback((nextRequest: RequestDetails, forceBaseline: boolean) => {
        const nextSignature = buildRequestDetailsSignature(nextRequest);
        if (requestSignatureRef.current !== nextSignature) {
            requestSignatureRef.current = nextSignature;
            setRequestDetails(nextRequest);
            setOffers(nextRequest.offers ?? []);
            setOffersStatusMap(
                (nextRequest.offers ?? []).reduce<Record<number, OfferDecisionStatus>>((acc, offer) => {
                    acc[offer.offer_id] = normalizeOfferStatus(offer.status);
                    return acc;
                }, {})
            );
        }

        if (forceBaseline) {
            const nextStatus = (statusOptions.find((o) => o.value === nextRequest.status)?.value ?? 'open') as RequestStatus;
            const nextDeadline = toDateInputValue(nextRequest.deadline_at);
            const nextOwner = nextRequest.id_user ?? '';
            const nextInitialAmount = toAmountInputValue(nextRequest.initial_amount);
            const nextFinalAmount = toAmountInputValue(nextRequest.final_amount);
            setStatus(nextStatus);
            setBaselineStatus(nextStatus);
            setDeadline(nextDeadline);
            setBaselineDeadline(nextDeadline);
            setOwnerUserId(nextOwner);
            setBaselineOwnerUserId(nextOwner);
            setInitialAmount(nextInitialAmount);
            setBaselineInitialAmount(nextInitialAmount);
            setFinalAmount(nextFinalAmount);
            setBaselineFinalAmount(nextFinalAmount);
            setExistingFiles(nextRequest.files ?? []);
            setAdditionalEmails([]);
            setAdditionalEmailsEnabled(false);
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
                syncRequestState(nextRequest, !hasPendingChangesRef.current);
                setOffersError(null);
            } catch (error) {
                setOffersError(error instanceof Error ? error.message : 'Не удалось загрузить заявку');
            } finally {
                if (showLoading) {
                    setOffersLoading(false);
                }
            }
        },
        [requestId, syncRequestState]
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
                    label: `${item.full_name?.trim() || item.user_id} (${item.role})`,
                    unavailablePeriod: item.unavailable_period
                        ? {
                            status: item.unavailable_period.status,
                            startedAt: item.unavailable_period.started_at,
                            endedAt: item.unavailable_period.ended_at
                        }
                        : null
                }))
            );
        } catch {
            setOwnerOptions([]);
        }
    }, [canEditOwner]);


    useEffect(() => {
        void fetchRequest(true);
        const intervalId = window.setInterval(() => {
            if (document.hidden || hasPendingChangesRef.current) {
                return;
            }
            void fetchRequest(false);
        }, pollIntervalMs);
        return () => window.clearInterval(intervalId);
    }, [fetchRequest]);

    useEffect(() => {
        void fetchOwners();
    }, [fetchOwners]);

     const getSaveValidationError = (
        currentStatus: RequestStatus,
        currentDeadline: string,
        currentInitialAmount: string,
        currentFinalAmount: string
    ) => {
        const statusChanged = currentStatus !== baselineStatus;
        const ownerChanged = ownerUserId !== baselineOwnerUserId;
        const isReopen = statusChanged && baselineStatus !== 'open' && currentStatus === 'open';
        const deadlineChanged = currentDeadline !== baselineDeadline;
        const initialAmountChanged = canViewRequestAmounts && currentInitialAmount !== baselineInitialAmount;
        const finalAmountChanged = canViewRequestAmounts && currentFinalAmount !== baselineFinalAmount;
        const parsedInitialAmount = canViewRequestAmounts ? parseAmountInput(currentInitialAmount) : null;
        const parsedFinalAmount = canViewRequestAmounts ? parseAmountInput(currentFinalAmount) : null;

        const isFinalStatus = currentStatus === 'closed' || currentStatus === 'cancelled';
        if (!statusChanged && !deadlineChanged && !ownerChanged && !initialAmountChanged && !finalAmountChanged && !hasFileChanges) {
            return 'Нет изменений для сохранения';
        }

        if (canViewRequestAmounts) {
            if (Number.isNaN(parsedInitialAmount)) {
                return 'Укажите корректную сумму по ТЗ';
            }
            if (Number.isNaN(parsedFinalAmount)) {
                return 'Укажите корректную итоговую сумму';
            }
            if (parsedInitialAmount === null && (currentStatus === 'closed' || initialAmountChanged)) {
                return 'Укажите сумму по ТЗ';
            }
            if ((parsedInitialAmount !== null && parsedInitialAmount < 0) || (parsedFinalAmount !== null && parsedFinalAmount < 0)) {
                return 'Сумма не может быть отрицательной';
            }

            if (currentStatus === 'closed') {
                const acceptedOffer = offers.find((offer) => offer.status === 'accepted');
                if (parsedFinalAmount === null) {
                    return 'Для закрытия заявки укажите итоговую сумму';
                }
                if (!acceptedOffer) {
                    if (parsedFinalAmount !== parsedInitialAmount) {
                        return 'Для закрытия заявки без принятого КП итоговая сумма должна совпадать с суммой по ТЗ';
                    }
                } else if (acceptedOffer.offer_amount === null || acceptedOffer.offer_amount === undefined) {
                    return 'Для закрытия заявки с принятым КП у него должна быть указана сумма';
                } else if (parsedFinalAmount !== parsedInitialAmount && parsedFinalAmount !== acceptedOffer.offer_amount) {
                    return 'Итоговая сумма должна совпадать с суммой по ТЗ или с суммой принятого КП';
                }
            }
        }

        if ((deadlineChanged || isReopen) && !currentDeadline) {
            return 'При повторном открытии заявки необходимо установить дедлайн';
        }

        if (!isFinalStatus && currentDeadline && currentDeadline < todayDate) {
            return 'Дедлайн не может быть раньше текущей даты';
        }

        if (!isFinalStatus && deadlineChanged && currentStatus !== 'open' && currentStatus !== 'review') {
            return 'Для изменения дедлайна заявку необходимо повторно открыть';
        }

        if (ownerChanged && !canEditOwner) {
            return 'Изменение ответственного доступно только суперадмину и ведущему экономисту';
        }

        if (ownerChanged && ownerUserId && !ownerOptions.some((option) => option.id === ownerUserId)) {
            return 'Назначить ответственным можно только ведущего экономиста или экономиста';
        }

        const selectedOwner = ownerOptions.find((option) => option.id === ownerUserId);
        if (ownerChanged && selectedOwner?.unavailablePeriod) {
            const start = formatUnavailabilityDate(selectedOwner.unavailablePeriod.startedAt);
            const end = formatUnavailabilityDate(selectedOwner.unavailablePeriod.endedAt);
            return `Нельзя назначить ответственного: сотрудник в нерабочем статусе (${start} — ${end})`;
        }

        return null;
    };

    const effectiveDeadlineForValidation = status === 'review' ? todayDate : deadline;
    const saveValidationError = getSaveValidationError(status, effectiveDeadlineForValidation, initialAmount, finalAmount);

    const acceptedOfferId = useMemo(
        () => offers.find((offer) => offer.status === 'accepted')?.offer_id ?? null,
        [offers]
    );

    const handleSave = async () => {
        const currentRequest = requestDetails;
        if (!currentRequest || !canSaveRequestChanges) {
            return;
        }

        const statusChanged = status !== baselineStatus;
        const ownerChanged = ownerUserId !== baselineOwnerUserId;
        const parsedInitialAmount = canViewRequestAmounts ? parseAmountInput(initialAmount) : null;
        const parsedFinalAmount = canViewRequestAmounts ? parseAmountInput(finalAmount) : null;
        const initialAmountChanged = canViewRequestAmounts && initialAmount !== baselineInitialAmount;
        const finalAmountChanged = canViewRequestAmounts && finalAmount !== baselineFinalAmount;
        let effectiveDeadline = deadline;
        if (status === 'review') {
            effectiveDeadline = todayDate;
        }
        const deadlineChanged = effectiveDeadline !== baselineDeadline;

        const validationError = getSaveValidationError(status, effectiveDeadline, initialAmount, finalAmount);
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
                owner_user_id: ownerChanged ? ownerUserId : undefined,
                initial_amount: initialAmountChanged && parsedInitialAmount !== null ? parsedInitialAmount : undefined,
                final_amount: finalAmountChanged && parsedFinalAmount !== null ? parsedFinalAmount : undefined
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
        const targetOffer = offers.find((offer) => offer.offer_id === offerId);
        if (!targetOffer || (!targetOffer.actions.accept && !targetOffer.actions.reject)) {
            return;
        }
        
        const previousStatus = offersStatusMap[offerId] ?? '';

        setOffersStatusMap((prev) => ({
            ...prev,
            [offerId]: value
        }));

        if (!value) {
            return;
        }
        if (value === 'accepted' && acceptedOfferId && acceptedOfferId !== offerId) {
            setOffersStatusMap((prev) => ({
                ...prev,
                [offerId]: previousStatus
            }));
            setOffersError('Нельзя одобрить более одного КП в рамках одной заявки');
            return;
        }

        const confirmMessage =
            value === 'accepted'
                ? 'Если принять это КП, остальные КП по заявке автоматически получат статус «Отказано». Продолжить?'
                : 'Вы уверены, что хотите изменить статус КП на «Отказано»?';

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
            setOffersError(error instanceof Error ? error.message : 'Не удалось обновить статус КП');
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

    const handleSendAdditionalEmails = async () => {
        if (!requestDetails || !canSendAdditionalEmails) {
            return;
        }

        const nextAdditionalEmails = additionalEmailsFieldRef.current?.commitPendingInput();
        if (nextAdditionalEmails === null) {
            return;
        }

        if (!nextAdditionalEmails || nextAdditionalEmails.length === 0) {
            setErrorMessage('Добавьте хотя бы один e-mail для отправки');
            setSuccessMessage(null);
            return;
        }

        setIsSendingEmails(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const response = await sendRequestEmailNotifications({
                requestId: requestDetails.id,
                additional_emails: nextAdditionalEmails
            });
            setAdditionalEmails(response.data.sent_to);
            setSuccessMessage(
                response.data.sent_to.length === 1
                    ? `Письмо отправлено: ${response.data.sent_to[0]}`
                    : `Писем отправлено: ${response.data.sent_to.length}`
            );
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Не удалось отправить письма');
            setSuccessMessage(null);
        } finally {
            setIsSendingEmails(false);
        }
    };


    const detailsRows = [
        {
            id: 'owner',
            label: 'Ответственный',
            value: canEditOwner ? (
                <Select
                    size="small"
                    value={ownerUserId}
                    renderValue={(selected) => ownerOptions.find((option) => option.id === selected)?.label ?? requestDetails?.owner_full_name ?? String(selected ?? '')}
                    onChange={(event) => setOwnerUserId(event.target.value)}
                    sx={{ minWidth: 200 }}
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
            ) : (requestDetails?.owner_full_name ?? requestDetails?.id_user ?? '-')
        },
        { id: 'created', label: 'Создана', value: formatDate(requestDetails?.created_at ?? null) },
        { id: 'closed', label: 'Закрыта', value: formatDate(requestDetails?.closed_at ?? null) },
        { id: 'offer', label: 'Номер КП', value: requestDetails?.id_offer ?? '-' },
        ...(canViewRequestAmounts
            ? [
                {
                    id: 'initialAmount',
                    label: 'Сумма по ТЗ, руб.',
                    value: (
                        <TextField
                            size="small"
                            value={initialAmount}
                            onChange={(event) => setInitialAmount(event.target.value)}
                            disabled={!canEditRequest}
                            inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                            sx={{ minWidth: 150 }}
                        />
                    )
                },
                {
                    id: 'finalAmount',
                    label: 'Итоговая сумма, руб.',
                    value: (
                        <TextField
                            size="small"
                            value={finalAmount}
                            onChange={(event) => setFinalAmount(event.target.value)}
                            disabled={!canEditRequest}
                            inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                            sx={{ minWidth: 150 }}
                        />
                    )
                }
            ]
            : []),
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
            <Button
                variant="outlined"
                onClick={() => navigate('/requests')}
                sx={{ mb: 2, alignSelf: 'flex-start' }}
            >
                Назад
            </Button>
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
                    disabled={isSaving || !canSaveRequestChanges || !hasPendingChanges || Boolean(saveValidationError)}
                >
                    {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                </Button>
            </Stack>
            {hasPendingChanges && (
                <Typography color="warning.main" sx={{ mb: 2 }}>
                    Есть несохраненные изменения. При уходе со страницы они будут потеряны.
                </Typography>
            )}
            {hasPendingChanges && saveValidationError && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {saveValidationError}
                </Alert>
            )}
            {errorMessage && (
                <Alert severity="error" onClose={() => setErrorMessage(null)} sx={{ mb: 2 }}>
                    {errorMessage}
                </Alert>
            )}
            {successMessage && (
                <Alert severity="success" onClose={() => setSuccessMessage(null)} sx={{ mb: 2 }}>
                    {successMessage}
                </Alert>
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
                                        onDelete={canDeleteRequestFiles ? () => handleRemoveExistingFile(file.id) : undefined}
                                    />
                                ))}
                            </Box>
                        ) : (
                            <Typography variant="body2">Файлы не прикреплены</Typography>
                        )}

                        {canUploadRequestFiles && (
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
                    {status === 'open' && (
                        <ToggleSection
                            title="Дополнительная рассылка на электронную почту"
                            checked={additionalEmailsEnabled}
                            disabled={isAdditionalEmailsFieldUnavailable}
                            onChange={(_event, checked) => {
                                setAdditionalEmailsEnabled(checked);
                                if (!checked) {
                                    setAdditionalEmails([]);
                                }
                            }}
                            description="Для уже созданной открытой заявки письма будут отправлены только на адреса, которые вы добавите вручную."
                        >
                            <Stack spacing={1.5}>
                                <AdditionalEmailsField
                                    ref={additionalEmailsFieldRef}
                                    emails={additionalEmails}
                                    onChange={setAdditionalEmails}
                                    hideHeader
                                    addButtonVariant="icon"
                                    disabled={isAdditionalEmailsFieldUnavailable}
                                    helperText="Можно добавить несколько адресов через запятую."
                                    containerSx={{
                                        mt: 0,
                                        opacity: isAdditionalEmailsFieldUnavailable ? 0.5 : 1,
                                        transition: 'opacity 0.2s ease'
                                    }}
                                />
                                <Button
                                    variant="outlined"
                                    sx={{ width: 'fit-content' }}
                                    onClick={() => void handleSendAdditionalEmails()}
                                    disabled={isAdditionalEmailsFieldUnavailable}
                                >
                                    {isSendingEmails ? 'Отправка...' : 'Отправить'}
                                </Button>
                            </Stack>
                        </ToggleSection>
                    )}
                    {hasDeletedAlert && canMarkDeletedAlertViewed && (
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
                    acceptedOfferId={acceptedOfferId}
                    isLoading={offersLoading}
                    errorMessage={offersError}
                    statusOptions={offerStatusOptions}
                    onStatusChange={(offerId, value) => void handleOfferStatusChange(offerId, value)}
                    onOpenWorkspace={(offerId) => navigate(`/offers/${offerId}/workspace`)}
                    onDownloadFile={(downloadUrl, fileName) => void handleDownload(downloadUrl, fileName)}
                    canChangeStatus={canChangeOfferStatus}
                />
            </Box>
        </Box>
    );
};
