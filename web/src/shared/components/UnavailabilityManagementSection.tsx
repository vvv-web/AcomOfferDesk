import { Button, Dialog, DialogContent, Stack, Typography } from '@mui/material';
import type { FormEventHandler, ReactNode } from 'react';
import { blurActiveElement } from '@shared/lib/dom/blurActiveElement';
import {
  UnavailabilityStatusSection,
  type UnavailabilityPeriodView
} from './UnavailabilityStatusSection';

type UnavailabilityManagementSectionProps = {
  currentPeriod: UnavailabilityPeriodView | null;
  periods: UnavailabilityPeriodView[];
  canEdit?: boolean;
  isDialogOpen?: boolean;
  onOpenDialog?: () => void;
  onCloseDialog?: () => void;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  isSubmitting?: boolean;
  editor?: ReactNode;
  dialogNotice?: ReactNode;
  triggerLabel?: string;
  dialogTitle?: string;
  submitLabel?: string;
};

export const UnavailabilityManagementSection = ({
  currentPeriod,
  periods,
  canEdit = false,
  isDialogOpen = false,
  onOpenDialog,
  onCloseDialog,
  onSubmit,
  isSubmitting = false,
  editor,
  dialogNotice,
  triggerLabel = 'РЈСЃС‚Р°РЅРѕРІРёС‚СЊ РЅРµСЂР°Р±РѕС‡РёР№ РїРµСЂРёРѕРґ',
  dialogTitle = 'РЈСЃС‚Р°РЅРѕРІРёС‚СЊ РЅРµСЂР°Р±РѕС‡РёР№ РїРµСЂРёРѕРґ',
  submitLabel = 'РЎРѕС…СЂР°РЅРёС‚СЊ'
}: UnavailabilityManagementSectionProps) => {
  const handleOpenDialog = () => {
    blurActiveElement();
    onOpenDialog?.();
  };

  return (
    <Stack spacing={1.5}>
      <UnavailabilityStatusSection currentPeriod={currentPeriod} periods={periods} />

      {canEdit ? (
        <>
          <Button variant="outlined" sx={{ borderRadius: 999 }} onClick={handleOpenDialog}>
            {triggerLabel}
          </Button>

          <Dialog
            open={isDialogOpen}
            onClose={onCloseDialog}
            fullWidth
            maxWidth="xs"
            PaperProps={{
              sx: {
                borderRadius: 4,
                maxWidth: 560
              }
            }}
          >
            <DialogContent sx={{ p: 3.5, backgroundColor: '#d9d9d9' }}>
              <Stack spacing={2} component="form" onSubmit={onSubmit}>
                <Typography variant="h5" fontWeight={700}>
                  {dialogTitle}
                </Typography>
                {dialogNotice}
                {editor}
                <Button type="submit" variant="outlined" sx={{ borderRadius: 999 }} disabled={isSubmitting}>
                  {submitLabel}
                </Button>
              </Stack>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </Stack>
  );
};
