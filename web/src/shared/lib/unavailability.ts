export type UnavailabilityPeriodInfo = {
  status: string;
  startedAt: string;
  endedAt: string;
};

const UNAVAILABILITY_STATUS_LABELS: Record<string, string> = {
  sick: 'Больничный',
  vacation: 'Отпуск',
  fired: 'Уволен',
  maternity: 'Декрет',
  business_trip: 'Командировка',
  unavailable: 'Недоступен'
};

export const formatUnavailabilityDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

export const getUnavailabilityStatusLabel = (status: string) => UNAVAILABILITY_STATUS_LABELS[status] ?? status;

export const getUnavailabilityTooltip = (period: UnavailabilityPeriodInfo) => {
  const statusLabel = getUnavailabilityStatusLabel(period.status);
  const startedAt = formatUnavailabilityDate(period.startedAt);
  const endedAt = formatUnavailabilityDate(period.endedAt);
  return `${statusLabel}: ${startedAt} — ${endedAt}`;
};
