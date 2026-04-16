import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import type { StatusTones } from '@mui/material/styles';

export type StatusPillTone = keyof StatusTones;

type StatusPillProps = {
  label: string;
  tone: StatusPillTone;
};

export const StatusPill = ({ label, tone }: StatusPillProps) => {
  const { palette } = useTheme();
  const { text, bg, border } = palette.statusTones[tone];

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.2,
        py: 0.3,
        borderRadius: 99,
        border: `1px solid ${border}`,
        backgroundColor: bg,
        color: text,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.3,
        width: 'fit-content',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {label}
    </Box>
  );
};
