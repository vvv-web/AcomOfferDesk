import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getResponsibilityDashboard,
  type ResponsibilityClosedSavingsItem,
  type ResponsibilitySavingsItem,
  type ResponsibilitySavingsSummary,
} from '@shared/api/users/getResponsibilityDashboard';
import { formatDate, formatAmount, formatSignedAmount } from '@shared/lib/formatters';
import { useIsMobileViewport } from '@shared/lib/responsive';

const emptySavings: ResponsibilitySavingsSummary = {
  total_closed_requests: 0,
  total_with_savings: 0,
  total_savings_amount: 0,
  closed_items: [],
  items: [],
};

type SummaryListItem = {
  key: string;
  title: string;
  subtitle: string;
  amount?: string;
  amountColor?: 'text.primary' | 'success.main' | 'error.main';
};

const toSummaryListItem = (item: ResponsibilitySavingsItem | ResponsibilityClosedSavingsItem): SummaryListItem => ({
  key: `request-${item.request_id}`,
  title: `Заявка #${item.request_id}`,
  subtitle: `${item.owner_full_name || item.owner_user_id}${item.closed_at ? ` · ${formatDate(item.closed_at)}` : ''}`,
  amount: typeof item.savings_amount === 'number' ? formatSignedAmount(item.savings_amount) : undefined,
  amountColor:
    typeof item.savings_amount === 'number'
      ? item.savings_amount >= 0
        ? 'success.main'
        : 'error.main'
      : undefined,
});

const toClosedSummaryListItem = (item: ResponsibilityClosedSavingsItem): SummaryListItem => {
  const base = toSummaryListItem(item);

  if (base.amount) {
    return base;
  }

  if (item.offer_amount === null) {
    return {
      ...base,
      amount: formatAmount(0),
      amountColor: 'text.primary',
    };
  }

  return base;
};

const SummaryListCard = ({
  title,
  value,
  valueColor = 'text.primary',
  items,
  emptyText,
  isExpanded,
  onToggle,
}: {
  title: string;
  value: string;
  valueColor?: 'text.primary' | 'success.main' | 'error.main';
  items: SummaryListItem[];
  emptyText: string;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ height: '100%' }}>
        <Stack spacing={1.5} sx={{ height: '100%' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {title}
              </Typography>
              <Typography variant="h5" fontWeight={800} color={valueColor}>
                {value}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onToggle} aria-label={isExpanded ? 'Свернуть список' : 'Развернуть список'}>
              {isExpanded ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
            </IconButton>
          </Stack>

          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Stack spacing={0.75} sx={{ maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>
              {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {emptyText}
                </Typography>
              ) : (
                items.map((item) => (
                  <Box
                    key={item.key}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      px: 1.25,
                      py: 1,
                      backgroundColor: 'background.paper',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                      <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.subtitle}
                        </Typography>
                      </Stack>
                      {item.amount ? (
                        <Typography variant="body2" fontWeight={700} color={item.amountColor ?? 'text.primary'}>
                          {item.amount}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>
                ))
              )}
            </Stack>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
};

const roundPercent = (value: number) => Math.round(value * 10) / 10;
const toRadians = (angle: number) => (Math.PI / 180) * angle;

const describeSectorPath = (centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) => {
  const safeSweep = Math.min(Math.max(endAngle - startAngle, 0), 359.999);
  const startX = centerX + radius * Math.cos(toRadians(startAngle));
  const startY = centerY + radius * Math.sin(toRadians(startAngle));
  const endX = centerX + radius * Math.cos(toRadians(startAngle + safeSweep));
  const endY = centerY + radius * Math.sin(toRadians(startAngle + safeSweep));
  const largeArcFlag = safeSweep > 180 ? 1 : 0;

  return `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
};

const SavingsRatioChart = ({
  savingsAmount,
  lostSavingsAmount,
}: {
  savingsAmount: number;
  lostSavingsAmount: number;
}) => {
  const positiveSavings = Math.max(savingsAmount, 0);
  const totalLostSavings = Math.max(lostSavingsAmount, 0);
  const chartTotal = positiveSavings + totalLostSavings;
  const [activeSliceKey, setActiveSliceKey] = useState<'savings' | 'lost' | null>(null);

  if (chartTotal === 0) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.75 }}>
            Соотношение экономии
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Пока нет закрытых заявок с рассчитанной экономией.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const segments = [
    {
      key: 'savings' as const,
      label: 'Экономия',
      amount: positiveSavings,
      percent: (positiveSavings / chartTotal) * 100,
      color: '#2e7d32',
    },
    {
      key: 'lost' as const,
      label: 'Упущенная экономия',
      amount: totalLostSavings,
      percent: (totalLostSavings / chartTotal) * 100,
      color: '#d32f2f',
    },
  ].filter((segment) => segment.amount > 0.0001);

  const pieRadius = 80;
  let currentAngle = -90;
  const pieSegments = segments.map((segment) => {
    const sweep = (segment.amount / chartTotal) * 360;
    const endAngle = currentAngle + sweep;
    const result = {
      ...segment,
      startAngle: currentAngle,
      endAngle,
    };
    currentAngle = endAngle;
    return result;
  });

  return (
    <Card
      sx={{
        borderRadius: 2,
        background: 'linear-gradient(135deg, rgba(231,240,255,0.92), rgba(255,255,255,0.98))',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 700 }}>
          Соотношение экономии
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Диаграмма показывает долю найденной и упущенной экономии.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '128px minmax(0, 1fr)', md: '220px minmax(0, 1fr)' },
            gap: { xs: 1.25, md: 2 },
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                position: 'relative',
                width: { xs: 128, md: 180 },
                height: { xs: 128, md: 180 },
                borderRadius: '50%',
                boxShadow: 'inset 0 0 0 1px rgba(47,111,214,0.16), 0 10px 24px rgba(31,42,68,0.12)',
              }}
            >
              <Box component="svg" viewBox="0 0 200 200" sx={{ width: '100%', height: '100%' }}>
                {pieSegments.map((segment) => (
                  <path
                    key={segment.key}
                    d={describeSectorPath(100, 100, pieRadius, segment.startAngle, segment.endAngle)}
                    fill={segment.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setActiveSliceKey(segment.key)}
                    onMouseLeave={() => setActiveSliceKey(null)}
                  >
                    <title>{`${segment.label}: ${formatAmount(segment.amount)}`}</title>
                  </path>
                ))}
              </Box>
            </Box>
          </Box>

          <Stack spacing={{ xs: 0.8, md: 1.25 }}>
            {pieSegments.map((segment) => (
              <Card
                key={segment.key}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  borderColor: activeSliceKey === segment.key ? segment.color : 'divider',
                }}
              >
                <CardContent sx={{ py: { xs: 0.75, md: 1.5 }, px: { xs: 1.1, md: 2 }, '&:last-child': { pb: { xs: 0.75, md: 1.5 } } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.75}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: segment.color, flexShrink: 0 }} />
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {segment.label}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color={segment.key === 'savings' ? 'success.main' : 'error.main'} noWrap>
                      {formatAmount(segment.amount)} ({roundPercent(segment.percent)}%)
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            ))}

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={600}>
                    Всего экономии и упущенной
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    {formatAmount(chartTotal)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

const SavingsTzMetrics = ({
  totalTzAmount,
  savingsAmount,
  lostSavingsAmount,
}: {
  totalTzAmount: number;
  savingsAmount: number;
  lostSavingsAmount: number;
}) => {
  const baseTzAmount = Math.max(totalTzAmount, 0);
  const positiveSavings = Math.max(savingsAmount, 0);
  const totalLostSavings = Math.max(lostSavingsAmount, 0);
  const savingsPercent = baseTzAmount > 0 ? (positiveSavings / baseTzAmount) * 100 : 0;
  const lostPercent = baseTzAmount > 0 ? (totalLostSavings / baseTzAmount) * 100 : 0;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 700 }}>
          Показатели по ТЗ
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Проценты рассчитываются от общей суммы по ТЗ закрытых заявок.
        </Typography>
        <Stack spacing={1.25}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="body2" fontWeight={600}>
                  Общая сумма по ТЗ
                </Typography>
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  {formatAmount(baseTzAmount)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="body2" fontWeight={600}>
                  Найденная экономия от ТЗ
                </Typography>
                <Typography variant="body2" fontWeight={700} color="success.main">
                  {formatAmount(positiveSavings)} ({roundPercent(savingsPercent)}%)
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="body2" fontWeight={600}>
                  Упущенная экономия от ТЗ
                </Typography>
                <Typography variant="body2" fontWeight={700} color="error.main">
                  {formatAmount(totalLostSavings)} ({roundPercent(lostPercent)}%)
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </CardContent>
    </Card>
  );
};

export const ProjectManagerSavingsDashboard = () => {
  const isMobileViewport = useIsMobileViewport();
  const [savings, setSavings] = useState<ResponsibilitySavingsSummary>(emptySavings);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState({
    closed: true,
    withSavings: true,
    savings: true,
    lost: true,
  });

  useEffect(() => {
    setExpandedCards({
      closed: !isMobileViewport,
      withSavings: !isMobileViewport,
      savings: !isMobileViewport,
      lost: !isMobileViewport
    });
  }, [isMobileViewport]);

  const loadSavings = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getResponsibilityDashboard();
      setSavings(response.savings);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить статистику экономии');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSavings();
  }, [loadSavings]);

  const itemsByClosed = useMemo(
    () =>
      [...(savings.closed_items ?? [])].sort((left, right) => {
        const leftTime = left.closed_at ? new Date(left.closed_at).getTime() : 0;
        const rightTime = right.closed_at ? new Date(right.closed_at).getTime() : 0;
        return rightTime - leftTime;
      }),
    [savings.closed_items]
  );

  const itemsWithSavings = useMemo(
    () => [...savings.items].sort((left, right) => Math.abs(right.savings_amount) - Math.abs(left.savings_amount)),
    [savings.items]
  );

  const positiveItems = useMemo(() => itemsWithSavings.filter((item) => item.savings_amount > 0), [itemsWithSavings]);

  const negativeItems = useMemo(() => itemsWithSavings.filter((item) => item.savings_amount < 0), [itemsWithSavings]);

  const summary = useMemo(() => {
    return savings.items.reduce(
      (acc, item) => {
        if (item.savings_amount > 0) {
          acc.totalSavings += item.savings_amount;
        } else {
          acc.lostSavings += Math.abs(item.savings_amount);
        }

        return acc;
      },
      { totalSavings: 0, lostSavings: 0 }
    );
  }, [savings.items]);

  const totalTzAmount = useMemo(
    () =>
      (savings.closed_items ?? []).reduce((acc, item) => {
        const amount = item.initial_amount ?? 0;
        return acc + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [savings.closed_items]
  );

  const closedItemsList = useMemo(() => itemsByClosed.map((item) => toClosedSummaryListItem(item)), [itemsByClosed]);

  const withSavingsList = useMemo(() => itemsWithSavings.map((item) => toSummaryListItem(item)), [itemsWithSavings]);

  const positiveList = useMemo(() => positiveItems.map((item) => toSummaryListItem(item)), [positiveItems]);

  const negativeList = useMemo(() => negativeItems.map((item) => toSummaryListItem(item)), [negativeItems]);

  const toggleCard = (key: 'closed' | 'withSavings' | 'savings' | 'lost') => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`Закрытых заявок: ${savings.total_closed_requests}`} color="primary" variant="outlined" size="small" />
        <Chip label={`С расчетом экономии: ${savings.total_with_savings}`} color="info" variant="outlined" size="small" />
        <Chip label={`С экономией: ${positiveItems.length}`} color="success" variant="outlined" size="small" />
        <Chip label={`С минусом: ${negativeItems.length}`} color="error" variant="outlined" size="small" />
      </Stack>

      {errorMessage ? (
        <Alert severity="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      ) : null}

      {isLoading ? (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography color="text.secondary">Загрузка...</Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) minmax(0, 1fr)' },
              gap: 1.5,
            }}
          >
            <SavingsRatioChart savingsAmount={summary.totalSavings} lostSavingsAmount={summary.lostSavings} />
            <SavingsTzMetrics totalTzAmount={totalTzAmount} savingsAmount={summary.totalSavings} lostSavingsAmount={summary.lostSavings} />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <SummaryListCard
              title="Закрытые заявки"
              value={String(savings.total_closed_requests)}
              items={closedItemsList}
              emptyText="Нет закрытых заявок с детализацией."
              isExpanded={expandedCards.closed}
              onToggle={() => toggleCard('closed')}
            />
            <SummaryListCard
              title="С расчетом экономии"
              value={String(savings.total_with_savings)}
              items={withSavingsList}
              emptyText="Нет заявок с расчетом экономии."
              isExpanded={expandedCards.withSavings}
              onToggle={() => toggleCard('withSavings')}
            />
            <SummaryListCard
              title="Экономия"
              value={formatAmount(summary.totalSavings)}
              valueColor={summary.totalSavings > 0 ? 'success.main' : 'text.primary'}
              items={positiveList}
              emptyText="Нет заявок с экономией."
              isExpanded={expandedCards.savings}
              onToggle={() => toggleCard('savings')}
            />
            <SummaryListCard
              title="Упущенная экономия"
              value={formatAmount(summary.lostSavings)}
              valueColor="error.main"
              items={negativeList}
              emptyText="Нет заявок с отрицательной экономией."
              isExpanded={expandedCards.lost}
              onToggle={() => toggleCard('lost')}
            />
          </Box>
        </>
      )}
    </Stack>
  );
};
