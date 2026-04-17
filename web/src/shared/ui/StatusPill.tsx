import { Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

export type StatusPillTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

type StatusPillProps = {
  label: string;
  tone: StatusPillTone;
};

export const StatusPill = ({ label, tone }: StatusPillProps) => {
  const theme = useTheme();
  const color =
    tone === 'success'
      ? theme.palette.success.main
      : tone === 'warning'
      ? theme.palette.warning.main
      : tone === 'error'
      ? theme.palette.error.main
      : tone === 'info'
      ? theme.palette.info.main
      : theme.palette.text.secondary;

  return (
    <Stack
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0,
        maxWidth: '100%',
        px: 1.4,
        minHeight: 30,
        borderRadius: '999px',
        border: '2px solid',
        borderColor: color,
        bgcolor: alpha(color, 0.12),
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <Typography
        component="span"
        sx={{
          minWidth: 0,
          maxWidth: '100%',
          display: 'block',
          fontSize: 14,
          fontWeight: 600,
          color,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Typography>
    </Stack>
  );
};
