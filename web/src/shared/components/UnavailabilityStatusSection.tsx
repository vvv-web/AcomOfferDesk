import { Box, Stack, Typography } from '@mui/material';

export type UnavailabilityPeriodView = {
  id: number;
  status: string;
  startedAt: string;
  endedAt: string;
};

type UnavailabilityStatusSectionProps = {
  title?: string;
  currentPeriod: UnavailabilityPeriodView | null;
  periods: UnavailabilityPeriodView[];
};

const formatPeriodDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('ru-RU');
};

const DataRow = ({ label, value }: { label: string; value: string | null }) => (
  <Stack direction="row" spacing={2}>
    <Typography sx={{ width: 170, color: 'text.primary' }}>{label}</Typography>
    <Typography color={value ? 'text.primary' : 'text.secondary'}>{value ?? 'Не указано'}</Typography>
  </Stack>
);

export const UnavailabilityStatusSection = ({
  title = 'Нерабочий статус',
  currentPeriod,
  periods
}: UnavailabilityStatusSectionProps) => (
  <Stack spacing={1.5}>
    <Typography variant="h5" fontWeight={700}>
      {title}
    </Typography>
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 1.5,
        backgroundColor: 'rgba(255,255,255,0.24)'
      }}
    >
      <DataRow label="Причина" value={currentPeriod?.status ?? 'Не установлен'} />
      <DataRow label="Начало" value={formatPeriodDate(currentPeriod?.startedAt)} />
      <DataRow label="Окончание" value={formatPeriodDate(currentPeriod?.endedAt)} />
    </Box>
    {periods.length ? (
      <Stack spacing={1} sx={{ mt: 1.5 }}>
        <Typography fontWeight={600}>Все периоды</Typography>
        {periods.map((period) => (
          <Box
            key={period.id}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 1.25,
              backgroundColor: '#fff'
            }}
          >
            <DataRow label="Причина" value={period.status} />
            <DataRow label="Начало" value={formatPeriodDate(period.startedAt)} />
            <DataRow label="Окончание" value={formatPeriodDate(period.endedAt)} />
          </Box>
        ))}
      </Stack>
    ) : null}
  </Stack>
);
