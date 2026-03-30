import { Stack, Typography } from '@mui/material';
import type { HeaderBackAction } from '../model/types';

type HeaderTitleProps = {
  title?: string;
  backAction?: HeaderBackAction;
};

export const HeaderTitle = ({ title, backAction }: HeaderTitleProps) => {
  if (!title && !backAction) {
    return null;
  }

  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      {backAction ? null : title ? (
        <Typography variant="h5" fontWeight={700} sx={{ color: '#1f3b6d', lineHeight: 1.1 }}>
          {title}
        </Typography>
      ) : null}
    </Stack>
  );
};
