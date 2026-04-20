import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    IconButton,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { OffersTable } from './OffersTable';
import type { OfferDecisionStatus, OfferStatusOption } from './OffersTable';
import { formatDate } from '@shared/lib/formatters';
import { getRequestDetails } from '@shared/api/requests/getRequestDetails';
import type { RequestDetails, RequestDetailsFile, RequestDetailsOffer } from '@shared/api/requests/getRequestDetails';
import { getRequestEconomists } from '@shared/api/requests/getRequestEconomists';
import { sendRequestEmailNotifications } from '@shared/api/requests/sendRequestEmailNotifications';
import { markDeletedAlertViewed } from '@shared/api/offers/markDeletedAlertViewed';
import { updateOfferStatus } from '@shared/api/offers/updateOfferStatus';
import { deleteRequestFile, updateRequestDetails, uploadRequestFile } from '@shared/api/requests/updateRequestDetails';
import { downloadFile } from '@shared/api/fileDownload';
import { AdditionalEmailsField, type AdditionalEmailsFieldHandle } from '@shared/components/AdditionalEmailsField';
import { DatePickerField } from '@shared/components/DatePickerField';
import { UnavailableAwareMenuItem } from '@shared/components/UnavailableAwareMenuItem';
import { ToggleSection } from '@shared/components/ToggleSection';
import { getFileKey } from '@shared/lib/files';
import { formatUnavailabilityDate, type UnavailabilityPeriodInfo } from '@shared/lib/unavailability';
import { useRequestDetails } from '../model/useRequestDetails';
import {
    type RequestStatus,
    statusOptions,
    toDateInputValue,
    toAmountInputValue,
    parseAmountInput,
    normalizeOfferStatus,
    buildRequestDetailsSignature,
    toDeadlineIso,
} from '../model/requestDetailsUtils';
import { CreateManualOfferDialog } from './CreateManualOfferDialog';

const offerStatusOptions: OfferStatusOption[] = [
    { value: 'accepted', label: 'Принято' },
    { value: 'rejected', label: 'Отказано' }
];

const requestStatusToneByValue: Record<RequestStatus, 'success' | 'warning' | 'neutral'> = {
    open: 'success',
    review: 'warning',
    closed: 'neutral',
    cancelled: 'neutral'
};

const detailFieldSx = {
    width: { xs: '100%', sm: 142 },
    '& .MuiOutlinedInput-root': {
        borderRadius: 999,
        minHeight: 34
    },
    '& .MuiOutlinedInput-input': {
        px: 1.1,
        py: 0.6,
        fontSize: 14
    }
} as const;

type DetailRowProps = {
    label: string;
    children: ReactNode;
    divider?: boolean;
};

const DetailRow = ({ label, children, divider = true }: DetailRowProps) => (
    <Box
        sx={(theme) => ({
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
            alignItems: 'center',
            gap: 1,
            px: 1.25,
            py: 0.8,
            borderBottom: divider ? `1px solid ${theme.palette.divider}` : 'none',
        })}
    >
        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.2 }}>
            {label}
        </Typography>
        <Box sx={{ justifySelf: { xs: 'stretch', sm: 'end' }, display: 'flex' }}>{children}</Box>
    </Box>
);

const detailValueTextSx = {
    justifySelf: { xs: 'stretch', sm: 'end' },
    textAlign: { xs: 'left', sm: 'right' },
    fontWeight: 500,
    fontSize: 14,
    lineHeight: 1.3
} as const;

export const RequestDetailsView = () => {
    const { navigate, requestId } = useRequestDetails();
    const theme = useTheme();

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
    const [isEditMode, setIsEditMode] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isDescriptionOverflowing, setIsDescriptionOverflowing] = useState(false);
    const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
    const [additionalEmailsEnabled, setAdditionalEmailsEnabled] = useState(false);
    const additionalEmailsFieldRef = useRef<AdditionalEmailsFieldHandle | null>(null);
    const descriptionTextRef = useRef<HTMLParagraphElement | null>(null);
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
    const [isManualOfferDialogOpen, setIsManualOfferDialogOpen] = useState(false);
    const pollIntervalMs = 10000;

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
    const canCreateManualOffer = useMemo(
        () => status === 'open' && Boolean(requestDetails?.actions.create_offer),
        [requestDetails?.actions.create_offer, status]
    );
    const canSaveRequestChanges =
        (hasRequestFieldChanges && canEditRequest)
        || (hasOwnerChange && canEditOwner)
        || (deletedFileIds.length > 0 && canDeleteRequestFiles)
        || (Boolean(newFile) && canUploadRequestFiles);
    const canEnterEditMode = canEditRequest || canEditOwner || canUploadRequestFiles || canDeleteRequestFiles;
    const statusTone = requestStatusToneByValue[status] ?? 'neutral';
    const statusColor = statusTone === 'success'
        ? theme.palette.success.main
        : statusTone === 'warning'
            ? theme.palette.warning.main
            : theme.palette.text.secondary;

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
            setIsEditMode(false);
            setDeletedFileIds([]);
            setNewFile(null);
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

    const handleCancelEditing = () => {
        setStatus(baselineStatus);
        setDeadline(baselineDeadline);
        setOwnerUserId(baselineOwnerUserId);
        setInitialAmount(baselineInitialAmount);
        setFinalAmount(baselineFinalAmount);
        setDeletedFileIds([]);
        setNewFile(null);
        setIsEditMode(false);
        setErrorMessage(null);
        setSuccessMessage(null);
    };

    const ownerField = canEditOwner && isEditMode ? (
        <Select
            size="small"
            value={ownerUserId}
            fullWidth
            renderValue={(selected) =>
                ownerOptions.find((option) => option.id === selected)?.label
                ?? requestDetails?.owner_full_name
                ?? String(selected ?? '')
            }
            onChange={(event) => setOwnerUserId(event.target.value)}
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
        <TextField
            size="small"
            value={requestDetails?.owner_full_name ?? requestDetails?.id_user ?? '-'}
            fullWidth
            InputProps={{ readOnly: true }}
        />
    );
    const descriptionText = requestDetails?.description?.trim() ?? '';
    const canExpandDescription = isDescriptionOverflowing;

    useEffect(() => {
        const element = descriptionTextRef.current;
        if (!element) {
            setIsDescriptionOverflowing(false);
            return;
        }
        if (isDescriptionExpanded) {
            return;
        }

        const checkOverflow = () => {
            setIsDescriptionOverflowing(element.scrollHeight - element.clientHeight > 1);
        };

        checkOverflow();
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [descriptionText, isDescriptionExpanded]);

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
            {hasPendingChanges && (
                <Typography role="status" color="warning.main" sx={{ mb: 2 }}>
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
                    borderRadius: `${theme.acomShape.panelRadius}px`,
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    px: { xs: 2, md: 3 },
                    py: { xs: 2, md: 2.5 },
                    display: 'grid',
                    gap: 2.5,
                })}
            >
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    justifyContent="space-between"
                    spacing={1.5}
                >
                    <Typography variant="h5" fontWeight={700}>
                        Заявка №{requestDetails.id}
                    </Typography>
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
                        disabled={!canEditRequest || !isEditMode}
                        sx={{
                            minWidth: { xs: '100%', sm: 170, md: 190 },
                            borderRadius: 999,
                            color: statusColor,
                            fontWeight: 600,
                            backgroundColor: alpha(statusColor, 0.1),
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: statusColor },
                            '& .MuiSelect-icon': { color: statusColor },
                            '&.Mui-disabled': {
                                opacity: 1,
                                color: statusColor,
                                WebkitTextFillColor: statusColor,
                                backgroundColor: alpha(statusColor, 0.1)
                            },
                            '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
                                borderColor: statusColor
                            },
                            '&.Mui-disabled .MuiSelect-icon': {
                                color: statusColor,
                                opacity: 1
                            }
                        }}
                    >
                        {statusOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                </Stack>

                <Box
                    sx={{
                        display: 'grid',
                        gap: 2,
                        gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' },
                        alignItems: 'stretch',
                    }}
                >
                    <Box
                        onClick={() => {
                            if (canExpandDescription) {
                                setIsDescriptionExpanded((prev) => !prev);
                            }
                        }}
                        sx={(themeValue) => ({
                            border: `1px solid ${themeValue.palette.divider}`,
                            borderRadius: `${themeValue.acomShape.controlRadius}px`,
                            px: 1.5,
                            py: 1,
                            minHeight: 74,
                            height: '100%',
                            cursor: canExpandDescription ? 'pointer' : 'default',
                            position: 'relative',
                            display: 'grid',
                            alignItems: 'center',
                        })}
                    >
                        <Typography
                            ref={descriptionTextRef}
                            component="p"
                            sx={{
                                pr: canExpandDescription ? 12 : 0,
                                whiteSpace: 'pre-wrap',
                                ...(isDescriptionExpanded
                                    ? {}
                                    : {
                                        display: '-webkit-box',
                                        WebkitBoxOrient: 'vertical',
                                        WebkitLineClamp: 2,
                                        overflow: 'hidden',
                                    })
                            }}
                        >
                            {descriptionText || 'Описание заявки отсутствует'}
                        </Typography>
                        {canExpandDescription ? (
                            <Typography
                                variant="caption"
                                sx={{
                                    position: 'absolute',
                                    right: 12,
                                    bottom: 8,
                                    color: 'primary.main',
                                    fontWeight: 600
                                }}
                            >
                                {isDescriptionExpanded ? 'Свернуть' : 'Развернуть'}
                            </Typography>
                        ) : null}
                    </Box>
                    <Stack spacing={0.6} sx={{ minHeight: 74, height: '100%', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                            Ответственный по заявке
                        </Typography>
                        {ownerField}
                    </Stack>
                </Box>

                <Stack spacing={0.75}>
                    <Typography variant="body2" color="text.secondary">
                        Файлы заявки
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                        {existingFiles.length > 0 ? (
                            existingFiles.map((file) => (
                                <Chip
                                    key={file.id}
                                    label={file.name}
                                    variant="outlined"
                                    onClick={() => void handleDownload(file.download_url, file.name)}
                                    onDelete={isEditMode && canDeleteRequestFiles ? () => handleRemoveExistingFile(file.id) : undefined}
                                    sx={{ borderRadius: 999 }}
                                />
                            ))
                        ) : (
                            <Typography variant="body2">Файлы не прикреплены</Typography>
                        )}
                        {newFile && (
                            <Chip
                                key={getFileKey(newFile)}
                                label={newFile.name}
                                variant="outlined"
                                color="primary"
                                onDelete={() => setNewFile(null)}
                                sx={{ borderRadius: 999 }}
                            />
                        )}
                        {isEditMode && canUploadRequestFiles && (
                            <IconButton
                                component="label"
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
                            >
                                <AddCircleOutlineIcon sx={{ fontSize: 32 }} />
                                <input
                                    hidden
                                    type="file"
                                    onChange={(event) => {
                                        setNewFile(event.target.files?.[0] ?? null);
                                        event.target.value = '';
                                    }}
                                />
                            </IconButton>
                        )}
                    </Stack>
                </Stack>

                <Box
                    sx={{
                        display: 'grid',
                        gap: 1.5,
                        gridTemplateColumns: { xs: '1fr', md: canViewRequestAmounts ? '1fr 1fr' : '1fr' },
                    }}
                >
                    <Box
                        sx={(themeValue) => ({
                            border: `1px solid ${themeValue.palette.divider}`,
                            borderRadius: `${themeValue.acomShape.controlRadius}px`,
                            overflow: 'hidden',
                            backgroundColor: themeValue.palette.background.paper,
                            p: 0.8,
                            boxShadow: '0 1px 3px rgba(17, 24, 39, 0.05)',
                        })}
                    >
                        <DetailRow label="Создана">
                            <Typography sx={detailValueTextSx}>{formatDate(requestDetails.created_at)}</Typography>
                        </DetailRow>
                        <DetailRow label="Закрыта">
                            <Typography sx={detailValueTextSx}>{formatDate(requestDetails.closed_at)}</Typography>
                        </DetailRow>
                        <DetailRow label="Дедлайн сбора КП" divider={!canViewRequestAmounts}>
                            {isEditMode && canEditRequest ? (
                                <DatePickerField
                                    value={deadline}
                                    onChange={setDeadline}
                                    showDropdownIcon={false}
                                    allowClear={false}
                                    minWidth={detailFieldSx.width}
                                    sx={{
                                        '& .MuiInputBase-root': {
                                            borderRadius: 999,
                                            minHeight: 34
                                        },
                                        '& .MuiInputBase-input': {
                                            px: 1.1,
                                            py: 0.6,
                                            fontSize: 14
                                        }
                                    }}
                                />
                            ) : (
                                <Typography sx={detailValueTextSx}>{formatDate(requestDetails.deadline_at)}</Typography>
                            )}
                        </DetailRow>
                        {!canViewRequestAmounts && (
                            <DetailRow label="Номер КП" divider={false}>
                                <Typography sx={detailValueTextSx}>{requestDetails.id_offer ?? '-'}</Typography>
                            </DetailRow>
                        )}
                    </Box>

                    {canViewRequestAmounts && (
                        <Box
                            sx={(themeValue) => ({
                                border: `1px solid ${themeValue.palette.divider}`,
                                borderRadius: `${themeValue.acomShape.controlRadius}px`,
                                overflow: 'hidden',
                                backgroundColor: themeValue.palette.background.paper,
                                p: 0.8,
                                boxShadow: '0 1px 3px rgba(17, 24, 39, 0.05)',
                            })}
                        >
                            <DetailRow label="Сумма по ТЗ, руб.">
                                {isEditMode && canEditRequest ? (
                                    <TextField
                                        size="small"
                                        value={initialAmount}
                                        onChange={(event) => setInitialAmount(event.target.value)}
                                        inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                                        sx={detailFieldSx}
                                    />
                                ) : (
                                    <Typography sx={detailValueTextSx}>{initialAmount || '-'}</Typography>
                                )}
                            </DetailRow>
                            <DetailRow label="Итоговая сумма, руб.">
                                {isEditMode && canEditRequest ? (
                                    <TextField
                                        size="small"
                                        value={finalAmount}
                                        onChange={(event) => setFinalAmount(event.target.value)}
                                        inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
                                        sx={detailFieldSx}
                                    />
                                ) : (
                                    <Typography sx={detailValueTextSx}>{finalAmount || '-'}</Typography>
                                )}
                            </DetailRow>
                            <DetailRow label="Номер КП" divider={false}>
                                <Typography sx={detailValueTextSx}>{requestDetails.id_offer ?? '-'}</Typography>
                            </DetailRow>
                        </Box>
                    )}
                </Box>

                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1.5}
                >
                    <Typography variant="body1">Обновлено {formatDate(requestDetails.updated_at, true)}</Typography>
                    <Stack direction="row" spacing={1}>
                        {isEditMode ? (
                            <>
                                <Button variant="outlined" onClick={handleCancelEditing} disabled={isSaving}>
                                    Отмена
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => void handleSave()}
                                    disabled={isSaving || !canSaveRequestChanges || !hasPendingChanges || Boolean(saveValidationError)}
                                >
                                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="outlined"
                                startIcon={<EditOutlined />}
                                onClick={() => setIsEditMode(true)}
                                disabled={!canEnterEditMode}
                            >
                                Изменить
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </Box>

            {status === 'open' && (
                <Box sx={{ mt: 2.5 }}>
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
                </Box>
            )}

            {hasDeletedAlert && canMarkDeletedAlertViewed && (
                <Button
                    variant="contained"
                    sx={(theme) => ({
                        mt: 2,
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
                    onAddClick={canCreateManualOffer ? () => setIsManualOfferDialogOpen(true) : undefined}
                />
            </Box>
            <CreateManualOfferDialog
                open={isManualOfferDialogOpen}
                requestId={requestDetails.id}
                onClose={() => setIsManualOfferDialogOpen(false)}
                onCreated={(workspacePath) => {
                    setIsManualOfferDialogOpen(false);
                    navigate(workspacePath);
                }}
            />
        </Box>
    );
};
