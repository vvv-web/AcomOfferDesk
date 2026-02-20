import { zodResolver } from '@hookform/resolvers/zod';
import {
    Alert,
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
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@app/providers/AuthProvider';
import { createRequest } from '@shared/api/createRequest';
import { hasAvailableAction } from '@shared/auth/availableActions';

const schema = z.object({
    description: z.string().max(3000, 'Максимум 3000 символов').optional(),
    deadlineAt: z.string().min(1, 'Укажите дату сбора КП'),
    files: z.array(z.instanceof(File)).min(1, 'Добавьте хотя бы один файл')
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
            files: []
        }
    });

    const files = watch('files');

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
        setIsSubmittingRequest(true);
        setErrorMessage(null);
        try {
            await createRequest({
                description: values.description?.trim() || null,
                deadline_at: `${values.deadlineAt}T23:59:59`,
                files: values.files
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
                                ×
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
                                🔗
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
                                            const nextFiles = Array.from(event.target.files ?? []);
                                            onChange(mergeUniqueFiles(value ?? [], nextFiles));
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
                                <Typography variant="body2"  color="text.secondary">Файлы не выбраны</Typography>
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