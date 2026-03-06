import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField
} from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createFeedback } from '@shared/api/createFeedback';

const schema = z.object({
  text: z.string().trim().min(1, 'Введите текст обратной связи').max(3000, 'Максимум 3000 символов')
});

type FormValues = z.infer<typeof schema>;

export const FeedbackButton = () => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      text: ''
    }
  });

  const currentTextLength = (watch('text') ?? '').length;

  const handleClose = () => {
    setOpen(false);
    setError(null);
    setSuccessMessage(null);
    reset({ text: '' });
  };

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setSuccessMessage(null);
    try {
      await createFeedback({ text: values.text.trim() });
      setSuccessMessage('Спасибо! Обратная связь отправлена.');
      reset({ text: '' });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить обратную связь');
    }
  };

  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        Обратная связь
      </Button>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>Обратная связь по сервису</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
            <TextField
              label="Ваш отзыв"
              multiline
              minRows={4}
              inputProps={{ maxLength: 3000 }}
              error={Boolean(errors.text)}
              helperText={errors.text ? `${errors.text.message} · ${currentTextLength}/3000` : `${currentTextLength}/3000`}
              {...register('text')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit(onSubmit)} variant="contained" disabled={isSubmitting}>
            Отправить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
