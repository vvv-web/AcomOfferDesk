import Box from '@mui/material/Box';
import SvgIcon from '@mui/material/SvgIcon';

type NotificationBadgeProps = {
  title?: string;
  size?: number;
};

const MAIL_PATH = 'M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z';

export const NotificationBadge = ({ title, size = 28 }: NotificationBadgeProps) => (
  <Box
    role="img"
    aria-label={title ?? 'Новое сообщение'}
    sx={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: (theme) => `1px solid ${theme.palette.primary.main}`,
      color: 'primary.main',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'background.paper',
    }}
    title={title}
  >
    <SvgIcon aria-hidden sx={{ fontSize: size * 0.57 }}>
      <path d={MAIL_PATH} />
    </SvgIcon>
  </Box>
);
