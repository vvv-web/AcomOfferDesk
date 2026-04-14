import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link, useSearchParams } from 'react-router-dom';

type StatusContent = {
  title: string;
  description: string;
};

const CONTENT_BY_REASON: Record<string, StatusContent> = {
  expired: {
    title: '\u0421\u0440\u043e\u043a \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u0441\u0441\u044b\u043b\u043a\u0438 \u0438\u0441\u0442\u0451\u043a',
    description:
      '\u0417\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043d\u043e\u0432\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443 \u043d\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044e \u0438 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0435\u0451 \u0441\u043d\u043e\u0432\u0430.',
  },
  invalid: {
    title: '\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u0430',
    description:
      '\u041f\u043e\u0445\u043e\u0436\u0435, \u0441\u0441\u044b\u043b\u043a\u0430 \u043f\u043e\u0432\u0440\u0435\u0436\u0434\u0435\u043d\u0430 \u0438\u043b\u0438 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f. \u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u043d\u043e\u0432\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443 \u043d\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044e.',
  },
  already_registered: {
    title: '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430',
    description:
      '\u0414\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f \u0443\u0436\u0435 \u0431\u044b\u043b\u0430 \u043d\u0430\u0447\u0430\u0442\u0430 \u0438\u043b\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430. \u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u043e\u0431\u044b\u0447\u043d\u044b\u0439 \u0432\u0445\u043e\u0434 \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0443.',
  },
};

const DEFAULT_CONTENT: StatusContent = {
  title: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443',
  description:
    '\u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0437\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u044c \u043d\u043e\u0432\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443 \u0438\u043b\u0438 \u0432\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u043a\u043e \u0432\u0445\u043e\u0434\u0443 \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0443.',
};

export const RegistrationLinkStatusPage = () => {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason')?.trim() ?? '';
  const content = CONTENT_BY_REASON[reason] ?? DEFAULT_CONTENT;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={(theme) => ({
          width: { xs: '100%', sm: 560 },
          p: { xs: 4, sm: 5 },
          borderRadius: 4,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        })}
      >
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography variant="h5" fontWeight={700} color="text.primary">
            {content.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {content.description}
          </Typography>
          <Stack spacing={1.5} width="100%">
            <Button component={Link} to="/login" variant="contained" fullWidth>
              {'\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a\u043e \u0432\u0445\u043e\u0434\u0443'}
            </Button>
            <Button component={Link} to="/" variant="outlined" fullWidth>
              {'\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};
