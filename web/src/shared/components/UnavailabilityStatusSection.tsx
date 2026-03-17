import { Box, Stack, SvgIcon, Typography } from '@mui/material';
import { UNAVAILABILITY_REASON_OPTIONS } from './UnavailabilityPeriodEditor';

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

const reasonLabels = new Map<string, string>(
  UNAVAILABILITY_REASON_OPTIONS.map((option) => [option.value, option.label])
);

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

const getReasonLabel = (value: string | null | undefined) => {
  if (!value) {
    return 'Не установлен';
  }

  return reasonLabels.get(value) ?? value;
};

const getAvailabilityText = (endedAt: string | null | undefined) => {
  if (!endedAt) {
    return 'Дата окончания статуса не указана.';
  }

  const end = new Date(endedAt);
  if (Number.isNaN(end.getTime())) {
    return 'Дата окончания статуса не указана.';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfStatusDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const diff = Math.max(
    0,
    Math.ceil((endOfStatusDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (diff === 0) {
    return 'Сотрудник будет доступен сегодня.';
  }

  const dayWord =
    diff % 10 === 1 && diff % 100 !== 11
      ? 'день'
      : diff % 10 >= 2 && diff % 10 <= 4 && (diff % 100 < 12 || diff % 100 > 14)
        ? 'дня'
        : 'дней';

  return `Сотрудник будет доступен через ${diff} ${dayWord}.`;
};

type StatusChipProps = {
  children: React.ReactNode;
  width?: number | string;
};

const StatusChip = ({ children, width }: StatusChipProps) => (
  <Box
    sx={{
      width,
      minWidth: 0,
      height: 42,
      px: 1.5,
      borderRadius: '21px',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
      border: '1px solid #c9d3e5',
      backgroundColor: '#f4f6fa',
      color: '#4b5c78'
    }}
  >
    {children}
  </Box>
);

export const UnavailabilityStatusSection = ({
  title = 'Нерабочий статус подчиненного',
  currentPeriod,
  periods
}: UnavailabilityStatusSectionProps) => {
  const reasonLabel = getReasonLabel(currentPeriod?.status);
  const startedAtLabel = formatPeriodDate(currentPeriod?.startedAt) ?? 'Не указано';
  const endedAtLabel = formatPeriodDate(currentPeriod?.endedAt) ?? 'Не указано';
  const availabilityText = getAvailabilityText(currentPeriod?.endedAt);

  return (
    <Stack spacing={1}>
      <Typography
        sx={{
          fontSize: 17,
          lineHeight: '22px',
          fontWeight: 400,
          color: '#44597b'
        }}
      >
        {title}
      </Typography>

      <Box
        sx={{
          border: '1px solid #c7d2e3',
          borderRadius: '22px',
          backgroundColor: '#f8f9fb',
          px: 1.5,
          py: 1.5
        }}
      >
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              alignItems: 'center',
              flexWrap: 'nowrap'
            }}
          >
            <StatusChip width={152}>
              <Stack
                direction="row"
                spacing={0.9}
                sx={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 0
                }}
              >
                <SvgIcon
                  sx={{
                    fontSize: 18,
                    color: '#7a69a8',
                    flexShrink: 0
                  }}
                >
                  <path d="M11 7h2v6l4.3 2.6-1 1.7L11 14V7Zm1-5a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Z" />
                </SvgIcon>

                <Typography
                  sx={{
                    fontSize: 12,
                    lineHeight: 1,
                    fontWeight: 500,
                    color: '#39465d',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {reasonLabel}
                </Typography>
              </Stack>
            </StatusChip>

            <StatusChip width={136}>
              <Typography
                sx={{
                  fontSize: 11,
                  lineHeight: 1,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  color: '#556684'
                }}
              >
                {startedAtLabel}
              </Typography>
            </StatusChip>

            <StatusChip width={136}>
              <Typography
                sx={{
                  fontSize: 11,
                  lineHeight: 1,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  color: '#556684'
                }}
              >
                {endedAtLabel}
              </Typography>
            </StatusChip>
          </Stack>

          <Typography
            sx={{
              pl: 0.5,
              fontSize: 12,
              lineHeight: '18px',
              fontWeight: 400,
              color: '#6c6f78'
            }}
          >
            {availabilityText}
          </Typography>
        </Stack>
      </Box>

      {periods.length > 0 ? (
        <Stack spacing={1}>
          <Typography
            sx={{
              fontSize: 14,
              lineHeight: '20px',
              fontWeight: 400,
              color: '#6d82a8'
            }}
          >
            Все периоды
          </Typography>

          {periods.map((period) => (
            <Box
              key={period.id}
              sx={{
                minHeight: 40,
                px: 1.5,
                border: '1px solid #d5ddea',
                borderRadius: '999px',
                backgroundColor: '#f6f7fa',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Typography
                sx={{
                  fontSize: 14,
                  lineHeight: '20px',
                  fontWeight: 400,
                  color: '#7a8caa'
                }}
              >
                {getReasonLabel(period.status)} · {formatPeriodDate(period.startedAt) ?? 'Не указано'} —{' '}
                {formatPeriodDate(period.endedAt) ?? 'Не указано'}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
};