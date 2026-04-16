import {
  Box,
  Card,
  CardContent,
  Stack,
  SvgIcon,
  Tooltip,
  Typography
} from '@mui/material';
import type { ResponsibilityEmployeeNode } from '@shared/api/users/getResponsibilityDashboard';
import { STATUS_LABELS, sumTotals, type StatusTotals } from './dashboardUtils';

export const ChevronUpIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fontSize: 20 }}>
    <path d="M7.41 14.59L12 10l4.59 4.59L18 13.17 12 7.17l-6 6z" />
  </SvgIcon>
);

export const ChevronDownIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fontSize: 20 }}>
    <path d="M7.41 8.41L12 13l4.59-4.59L18 9.83l-6 6-6-6z" />
  </SvgIcon>
);

export const SegmentedProgressBar = ({
  totals,
  statusColors,
  height = 24,
}: {
  totals: StatusTotals;
  statusColors: Record<string, string>;
  height?: number;
}) => {
  const normalizedEntries = Object.entries(totals)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => (a > b ? 1 : -1));
  const total = sumTotals(totals);

  if (total === 0) {
    return (
      <Box
        sx={{
          height,
          borderRadius: 999,
          backgroundColor: 'rgba(47,111,214,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Нет активных заявок
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        borderRadius: 999,
        overflow: 'hidden',
        height,
        backgroundColor: 'rgba(47,111,214,0.16)',
        border: '1px solid rgba(47,111,214,0.18)',
        boxShadow: 'inset 0 1px 2px rgba(31,42,68,0.08)'
      }}
    >
      {normalizedEntries.map(([status, count]) => {
        const widthPercent = (count / total) * 100;
        const label = `${STATUS_LABELS[status] ?? status}: ${count}`;
        return (
          <Tooltip key={`${status}-${count}`} title={label} arrow>
            <Box
              sx={{
                width: `${widthPercent}%`,
                minWidth: 8,
                backgroundColor: statusColors[status] ?? '#64748b',
                transition: 'width 200ms ease'
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
};

export const CircularProcessChart = ({ totals, statusColors }: { totals: StatusTotals; statusColors: Record<string, string> }) => {
  const entries = Object.entries(totals)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => (a > b ? 1 : -1));
  const total = sumTotals(totals);

  if (total === 0) {
    return (
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
            Общая диаграмма процесса заявок
          </Typography>
          <Typography color="text.secondary">Нет активных заявок для отображения диаграммы.</Typography>
        </CardContent>
      </Card>
    );
  }

  let offset = 0;
  const segments: string[] = [];
  for (const [status, count] of entries) {
    const percent = (count / total) * 100;
    const color = statusColors[status] ?? '#64748b';
    const start = offset;
    const end = offset + percent;
    segments.push(`${color} ${start}% ${end}%`);
    offset = end;
  }

  return (
    <Card
      sx={{
        borderRadius: 2,
        background: 'linear-gradient(135deg, rgba(231,240,255,0.92), rgba(255,255,255,0.98))',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 700 }}>
          Общая диаграмма процесса заявок
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Круговая диаграмма всех активных заявок по этапам процесса.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' },
            gap: 2,
            alignItems: 'center'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: `conic-gradient(${segments.join(', ')})`,
                p: '16px',
                boxShadow: 'inset 0 0 0 1px rgba(47,111,214,0.16), 0 10px 24px rgba(31,42,68,0.12)'
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: 'background.paper',
                  boxShadow: '0 0 0 1px rgba(47,111,214,0.10)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Всего в работе
                </Typography>
                <Typography variant="h4" fontWeight={800}>
                  {total}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Stack spacing={1.2}>
            {entries.map(([status, count]) => {
              const percent = Math.round((count / total) * 1000) / 10;
              return (
                <Card key={`process-${status}`} variant="outlined" sx={{ borderRadius: 2.5 }}>
                  <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: statusColors[status] ?? '#64748b'
                          }}
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {STATUS_LABELS[status] ?? status}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {count} · {percent}%
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export const EmployeeWorkloadChart = ({
  employees,
  workloadColors
}: {
  employees: ResponsibilityEmployeeNode[];
  workloadColors: string[];
}) => {
  const entries = employees
    .map((employee) => ({
      userId: employee.user_id,
      label: employee.full_name || employee.user_id,
      count: employee.in_progress_total
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = entries.reduce((acc, entry) => acc + entry.count, 0);

  if (total === 0) {
    return (
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
            Соотношение занятости сотрудников
          </Typography>
          <Typography color="text.secondary">Нет активных заявок для отображения диаграммы.</Typography>
        </CardContent>
      </Card>
    );
  }

  let offset = 0;
  const segments: string[] = [];
  for (const [index, entry] of entries.entries()) {
    const percent = (entry.count / total) * 100;
    const color = workloadColors[index % workloadColors.length] ?? '#64748b';
    const start = offset;
    const end = offset + percent;
    segments.push(`${color} ${start}% ${end}%`);
    offset = end;
  }

  return (
    <Card
      sx={{
        borderRadius: 2,
        background: 'linear-gradient(135deg, rgba(231,240,255,0.92), rgba(255,255,255,0.98))',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 700 }}>
          Соотношение занятости сотрудников
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Круговая диаграмма распределения активных заявок между сотрудниками.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' },
            gap: 2,
            alignItems: 'center'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: `conic-gradient(${segments.join(', ')})`,
                p: '16px',
                boxShadow: 'inset 0 0 0 1px rgba(47,111,214,0.16), 0 10px 24px rgba(31,42,68,0.12)'
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: 'background.paper',
                  boxShadow: '0 0 0 1px rgba(47,111,214,0.10)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Всего в работе
                </Typography>
                <Typography variant="h4" fontWeight={800}>
                  {total}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Stack spacing={1.2}>
            {entries.map((entry, index) => {
              const percent = Math.round((entry.count / total) * 1000) / 10;
              return (
                <Card key={`workload-${entry.userId}`} variant="outlined" sx={{ borderRadius: 2.5 }}>
                  <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: workloadColors[index % workloadColors.length] ?? '#64748b'
                          }}
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {entry.label}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {entry.count} · {percent}%
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};
