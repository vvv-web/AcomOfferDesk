import type { ButtonProps } from '@mui/material/Button';
import Button from '@mui/material/Button';
import type { SxProps, Theme } from '@mui/material/styles';

type ActionButtonKind = 'custom' | 'filled' | 'outlined';

export type ActionButtonProps = Omit<ButtonProps, 'variant' | 'color'> & {
  kind?: ActionButtonKind;
  selected?: boolean;
  showNavigationIcons?: boolean;
};

export const ActionButton = ({
  kind = 'custom',
  selected = false,
  sx,
  ...props
}: ActionButtonProps) => {
  const variant: ButtonProps['variant'] = kind === 'filled' ? 'contained' : kind === 'outlined' ? 'outlined' : 'text';

  const baseSx: SxProps<Theme> = {
    textTransform: 'none',
    fontWeight: 600,
    minWidth: 0,
    ...(selected
      ? {
        color: 'primary.main',
        backgroundColor: 'primary.50'
      }
      : null)
  };

  const mergedSx = (Array.isArray(sx) ? [baseSx, ...sx] : [baseSx, sx].filter(Boolean)) as SxProps<Theme>;

  return <Button {...props} variant={variant} disableElevation sx={mergedSx} />;
};
