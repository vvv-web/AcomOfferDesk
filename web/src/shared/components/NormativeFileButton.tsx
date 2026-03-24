import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { uploadNormativeFile } from '@shared/api/normative/uploadNormativeFile';
import { ROLE } from '@shared/constants/roles';
import { useAuth } from '@app/providers/AuthProvider';

export const NormativeFileButton = () => {
  const { session } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session?.roleId !== ROLE.LEAD_ECONOMIST) {
    return null;
  }

  const handleClose = () => {
    setOpen(false);
    setSelectedFile(null);
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Выберите файл');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await uploadNormativeFile(selectedFile, 1);
      setSuccessMessage('Нормативный документ загружен');
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить нормативный документ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        Добавить нормативный документ
      </Button>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>Загрузка нормативного документа</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
            <input
              ref={inputRef}
              type="file"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setError(null);
                setSuccessMessage(null);
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {selectedFile ? `Выбран файл: ${selectedFile.name}` : 'Нужно загрузить один файл в normative_files с id=1'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button onClick={() => void handleUpload()} variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Загружаем...' : 'Загрузить'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
