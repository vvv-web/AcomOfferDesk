import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createFeedback } from '@shared/api/feedback/createFeedback';
import { blurActiveElement } from '@shared/lib/dom/blurActiveElement';

const schema = z.object({
  text: z.string().trim().min(1, 'Введите текст обратной связи').max(3000, 'Максимум 3000 символов')
});

type FormValues = z.infer<typeof schema>;

const dialogPaperSx = (theme: Theme) => ({
  borderRadius: 2,
  px: { xs: 2.5, sm: 3.5 },
  py: { xs: 3, sm: 3.5 },
  backgroundColor: theme.palette.background.default,
  maxHeight: 'min(760px, calc(100vh - 32px))',
  overflow: 'hidden',
  boxShadow: `0 24px 80px ${alpha(theme.palette.common.black, 0.18)}`
});

const dialogContentSx = {
  p: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': {
    display: 'none'
  }
};

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

  const handleOpen = () => {
    blurActiveElement();
    setOpen(true);
  };

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
      <Button variant="outlined" onClick={handleOpen}>
        Обратная связь
      </Button>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogContent sx={dialogContentSx}>
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={600} lineHeight={1}>
                Обратная связь по сервису
              </Typography>

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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1,
                    backgroundColor: 'background.paper',
                    alignItems: 'flex-start'
                  }
                }}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="outlined"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  sx={{ borderRadius: 1, textTransform: 'none', py: 1.1 }}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={isSubmitting}
                  sx={{ borderRadius: 1, textTransform: 'none', py: 1.1, fontSize: 16, fontWeight: 700, boxShadow: 'none' }}
                >
                  Отправить
                </Button>
              </Stack>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};
