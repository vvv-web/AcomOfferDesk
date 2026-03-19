import { zodResolver } from '@hookform/resolvers/zod';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    Dialog,
    DialogContent,
    IconButton,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@app/providers/AuthProvider';
import { createRequest } from '@shared/api/requests/createRequest';
import { AdditionalEmailsField, type AdditionalEmailsFieldHandle } from '@shared/components/AdditionalEmailsField';
import { getRequestContractors, type RequestContractorItem } from '@shared/api/users/getRequestContractors';
import { hasAvailableAction } from '@shared/auth/availableActions';

const schema = z.object({
    description: z.string().max(3000, 'Максимум 3000 символов').optional(),
    deadlineAt: z.string().min(1, 'Укажите дату сбора КП'),
    files: z.array(z.instanceof(File)).min(1, 'Добавьте хотя бы один файл'),
    additionalEmails: z.array(z.string().email('Введите корректный email')).default([]),
    hiddenContractorIds: z.array(z.string().min(1)).default([])
});

type FormValues = z.infer<typeof schema>;

const getFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

const mergeUniqueFiles = (currentFiles: File[], addedFiles: File[]) => {
    const fileMap = new Map<string, File>();

    [...currentFiles, ...addedFiles].forEach((file) => {
        fileMap.set(getFileKey(file), file);
    });

    return Array.from(fileMap.values());
};

const getContractorOptionLabel = (contractor: RequestContractorItem) => {
    const primaryLabel = contractor.company_name?.trim() || contractor.full_name?.trim() || contractor.user_id;
    const secondaryLabel = contractor.company_mail?.trim() || contractor.mail?.trim() || contractor.user_id;
    return `${primaryLabel} (${secondaryLabel})`;
};

export const CreateRequestPage = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const canCreateRequest = hasAvailableAction(session, '/api/v1/requests', 'POST');
    const todayDate = useMemo(() => {
        const now = new Date();
        const offsetMs = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offsetMs).toISOString().split('T')[0];
    }, []);
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [contractorOptions, setContractorOptions] = useState<RequestContractorItem[]>([]);
    const [isLoadingContractors, setIsLoadingContractors] = useState(false);
    const additionalEmailsFieldRef = useRef<AdditionalEmailsFieldHandle | null>(null);

    const {
        control,
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors }
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            description: '',
            deadlineAt: todayDate,
            files: [],
            additionalEmails: [],
            hiddenContractorIds: []
        }
    });

    const files = watch('files');
    const additionalEmails = watch('additionalEmails');
    const hiddenContractorIds = watch('hiddenContractorIds');
    const hiddenContractors = useMemo(
        () => contractorOptions.filter((contractor) => hiddenContractorIds.includes(contractor.user_id)),
        [contractorOptions, hiddenContractorIds]
    );

    useEffect(() => {
        let isMounted = true;

        const loadContractors = async () => {
            setIsLoadingContractors(true);
            try {
                const response = await getRequestContractors();
                if (!isMounted) {
                    return;
                }
                setContractorOptions(response.items);
            } catch (error) {
                if (!isMounted) {
                    return;
                }
                setErrorMessage(error instanceof Error ? error.message : 'Ошибка загрузки контрагентов');
            } finally {
                if (isMounted) {
                    setIsLoadingContractors(false);
                }
            }
        };

        void loadContractors();

        return () => {
            isMounted = false;
        };
    }, []);

    const handleClose = () => {
        navigate('/requests');
    };

    const handleRemoveFile = (fileToRemove: File) => {
        const nextFiles = files.filter((file) => getFileKey(file) !== getFileKey(fileToRemove));
        setValue('files', nextFiles, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true
        });
    };

    const onSubmit = async (values: FormValues) => {
        const nextAdditionalEmails = additionalEmailsFieldRef.current?.commitPendingInput();
        if (nextAdditionalEmails === null) {
            return;
        }

        setIsSubmittingRequest(true);
        setErrorMessage(null);
        try {
            await createRequest({
                description: values.description?.trim() || null,
                deadline_at: `${values.deadlineAt}T23:59:59`,
                files: values.files,
                additional_emails: nextAdditionalEmails ?? values.additionalEmails,
                hidden_contractor_ids: values.hiddenContractorIds
            });
            navigate('/requests');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Ошибка создания заявки');
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    if (!canCreateRequest) {
        return <Navigate to="/requests" replace />;
    }

    return (
        <Dialog
            open
            onClose={handleClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{
                sx: {
                    borderRadius: 4,
                    p: { xs: 2, sm: 3 }
                }
            }}
        >
            <DialogContent sx={{ p: 0 }}>
                <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h5" fontWeight={600}>
                            Новая заявка
                        </Typography>
                        <IconButton aria-label="Закрыть" onClick={handleClose} sx={{ color: 'text.primary' }}>
                            <Typography component="span" fontSize={28} lineHeight={1}>
                                x
                            </Typography>
                        </IconButton>
                    </Stack>

                    <TextField
                        placeholder="Описание заявки"
                        multiline
                        minRows={5}
                        fullWidth
                        error={Boolean(errors.description)}
                        helperText={errors.description?.message}
                        {...register('description')}
                        sx={{
                            backgroundColor: 'background.paper',
                            borderRadius: 2,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2
                            }
                        }}
                    />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={3} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={500}>
                            Сбор КП до 23:59
                        </Typography>
                        <TextField
                            type="date"
                            error={Boolean(errors.deadlineAt)}
                            helperText={errors.deadlineAt?.message}
                            inputProps={{ min: todayDate }}
                            {...register('deadlineAt')}
                            sx={(theme) => ({
                                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                borderRadius: 999,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 999,
                                    backgroundColor: 'transparent'
                                }
                            })}
                        />
                    </Stack>

                    <Stack spacing={1.5} mt={3}>
                        <Typography variant="subtitle1" fontWeight={500}>
                            Скрыть от контрагентов
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Выбранные контрагенты не получат уведомления и не увидят заявку в списке открытых.
                        </Typography>
                        <Controller
                            control={control}
                            name="hiddenContractorIds"
                            render={({ field }) => (
                                <Autocomplete
                                    multiple
                                    options={contractorOptions}
                                    loading={isLoadingContractors}
                                    value={hiddenContractors}
                                    onChange={(_, value) => field.onChange(value.map((item) => item.user_id))}
                                    isOptionEqualToValue={(option, value) => option.user_id === value.user_id}
                                    getOptionLabel={getContractorOptionLabel}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder="Начните вводить компанию, ФИО, email или логин"
                                        />
                                    )}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => {
                                            const { key, ...tagProps } = getTagProps({ index });
                                            return (
                                                <Chip
                                                    key={key}
                                                    label={option.company_name || option.full_name || option.user_id}
                                                    {...tagProps}
                                                    variant="outlined"
                                                    sx={{
                                                        maxWidth: '100%',
                                                        borderRadius: 999,
                                                        backgroundColor: '#fff',
                                                        '& .MuiChip-label': {
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }
                                                    }}
                                                />
                                            );
                                        })
                                    }
                                    sx={{
                                        backgroundColor: 'background.paper',
                                        borderRadius: 2,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2
                                        }
                                    }}
                                />
                            )}
                        />
                    </Stack>

                    <AdditionalEmailsField
                        ref={additionalEmailsFieldRef}
                        emails={additionalEmails}
                        onChange={(nextEmails) => {
                            setValue('additionalEmails', nextEmails, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true
                            });
                        }}
                        helperText={errors.additionalEmails?.message ?? undefined}
                    />

                    <Alert severity="info" sx={{ mt: 2, borderRadius: 3 }}>
                        Карта партнера будет прикреплена к заявке автоматически.
                    </Alert>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={2} alignItems="flex-start">
                        <Button
                            variant="outlined"
                            component="label"
                            sx={{
                                borderRadius: 999,
                                textTransform: 'none',
                                paddingX: 3,
                                borderColor: 'primary.main',
                                color: 'primary.main'
                            }}
                        >
                            <Box component="span" sx={{ marginRight: 1 }}>
                                +
                            </Box>
                            Прикрепить файлы
                            <Controller
                                control={control}
                                name="files"
                                render={({ field: { value, onChange } }) => (
                                    <input
                                        type="file"
                                        hidden
                                        multiple
                                        onChange={(event) => {
                                            const nextFiles = Array.from(event.target.files ?? []) as File[];
                                            onChange(mergeUniqueFiles((value ?? []) as File[], nextFiles));
                                            event.target.value = '';
                                        }}
                                    />
                                )}
                            />
                        </Button>
                        <Stack spacing={0.5}>
                            {files.length > 0 ? (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {files.map((file) => (
                                        <Chip
                                            key={getFileKey(file)}
                                            label={file.name}
                                            onDelete={() => handleRemoveFile(file)}
                                            variant="outlined"
                                            sx={{
                                                maxWidth: '100%',
                                                borderRadius: 999,
                                                backgroundColor: '#fff',
                                                '& .MuiChip-label': {
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }
                                            }}
                                        />
                                    ))}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary">Файлы не выбраны</Typography>
                            )}
                            {errors.files ? (
                                <Typography variant="caption" color="error">
                                    {errors.files.message}
                                </Typography>
                            ) : null}
                        </Stack>
                    </Stack>

                    <Button
                        variant="contained"
                        fullWidth
                        type="submit"
                        disabled={isSubmittingRequest}
                        sx={(theme) => ({
                            marginTop: 3,
                            borderRadius: 999,
                            textTransform: 'none',
                            borderColor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                            backgroundColor: theme.palette.primary.main,
                            paddingY: 1.2,
                            fontSize: 18,
                            boxShadow: 'none',
                            '&:hover': {
                                backgroundColor: theme.palette.primary.dark,
                                boxShadow: 'none'
                            }
                        })}
                    >
                        {isSubmittingRequest ? 'Создание...' : 'Создать заявку'}
                    </Button>
                    {errorMessage ? (
                        <Typography mt={2} color="error" textAlign="center">
                            {errorMessage}
                        </Typography>
                    ) : null}
                </Box>
            </DialogContent>
        </Dialog>
    );
};
