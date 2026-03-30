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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));

const formatAmount = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatSignedAmount = (value: number) => `${value > 0 ? '+' : ''}${formatAmount(value)}`;

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

const SavingsBalanceChart = ({
  totalClosedAmount,
  netSavings,
  lostSavings,
}: {
  totalClosedAmount: number;
  netSavings: number;
  lostSavings: number;
}) => {
  const closedTotal = Math.max(totalClosedAmount, 0);
  const cleanSavings = Math.max(netSavings, 0);
  const totalLostSavings = Math.max(lostSavings, 0);
  const highlightedAmount = cleanSavings + totalLostSavings;
  const chartBase = Math.max(closedTotal, highlightedAmount);

  if (chartBase === 0) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.75 }}>
            Баланс экономии
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Пока нет закрытых заявок для расчета.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const neutralAmount = Math.max(chartBase - cleanSavings - totalLostSavings, 0);
  const cleanPercent = (cleanSavings / chartBase) * 100;
  const lostPercent = (totalLostSavings / chartBase) * 100;
  const neutralPercent = (neutralAmount / chartBase) * 100;
  const ringRadius = 74;
  const ringStrokeWidth = 28;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringSegments = [
    {
      key: 'clean',
      label: 'Чистая экономия',
      amount: cleanSavings,
      percent: cleanPercent,
      color: '#2e7d32',
    },
    {
      key: 'lost',
      label: 'Упущенная экономия',
      amount: totalLostSavings,
      percent: lostPercent,
      color: '#d32f2f',
    },
    {
      key: 'neutral',
      label: 'Без выделения',
      amount: neutralAmount,
      percent: neutralPercent,
      color: '#cbd5e1',
    },
  ].filter((segment) => segment.amount > 0.0001);

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
          Баланс экономии
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Общая сумма закрытых заявок с цветовым выделением: зеленым — чистая экономия, красным — упущенная. Наведите на сегмент диаграммы, чтобы увидеть сумму и категорию.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' },
            gap: 2,
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                position: 'relative',
                width: 180,
                height: 180,
                borderRadius: '50%',
                boxShadow: 'inset 0 0 0 1px rgba(47,111,214,0.16), 0 10px 24px rgba(31,42,68,0.12)',
              }}
            >
              <Box
                component="svg"
                viewBox="0 0 200 200"
                sx={{
                  width: '100%',
                  height: '100%',
                  transform: 'rotate(-90deg)',
                }}
              >
                {(() => {
                  let offsetLength = 0;
                  return ringSegments.map((segment) => {
                    const strokeLength = (segment.percent / 100) * ringCircumference;
                    const circle = (
                      <circle
                        key={segment.key}
                        cx="100"
                        cy="100"
                        r={ringRadius}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth={ringStrokeWidth}
                        strokeDasharray={`${strokeLength} ${Math.max(ringCircumference - strokeLength, 0)}`}
                        strokeDashoffset={-offsetLength}
                        strokeLinecap="butt"
                        style={{ cursor: 'help' }}
                      >
                        <title>{`${segment.label}: ${formatAmount(segment.amount)} (${Math.round(segment.percent * 10) / 10}%)`}</title>
                      </circle>
                    );
                    offsetLength += strokeLength;
                    return circle;
                  });
                })()}
              </Box>

              <Box
                sx={{
                  position: 'absolute',
                  inset: 16,
                  borderRadius: '50%',
                  backgroundColor: 'background.paper',
                  boxShadow: '0 0 0 1px rgba(47,111,214,0.10)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  px: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Сумма закрытых заявок
                </Typography>
                <Typography variant="subtitle1" fontWeight={800}>
                  {formatAmount(closedTotal)}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Stack spacing={1.25}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2563eb' }} />
                    <Typography variant="body2" fontWeight={600}>
                      Общая сумма закрытых
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="primary.main" fontWeight={700}>
                    {formatAmount(closedTotal)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2e7d32' }} />
                    <Typography variant="body2" fontWeight={600}>
                      Чистая экономия
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="success.main" fontWeight={700}>
                    {formatAmount(cleanSavings)} ({Math.round(cleanPercent * 10) / 10}%)
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#d32f2f' }} />
                    <Typography variant="body2" fontWeight={600}>
                      Упущенная экономия
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="error.main" fontWeight={700}>
                    {formatAmount(totalLostSavings)} ({Math.round(lostPercent * 10) / 10}%)
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

export const ProjectManagerSavingsDashboard = () => {
  const [savings, setSavings] = useState<ResponsibilitySavingsSummary>(emptySavings);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState({
    closed: true,
    withSavings: true,
    net: true,
    lost: true,
  });

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
        if (item.savings_amount >= 0) {
          acc.totalSavings += item.savings_amount;
        } else {
          acc.lostSavings += Math.abs(item.savings_amount);
        }

        return acc;
      },
      { totalSavings: 0, lostSavings: 0 }
    );
  }, [savings.items]);

  const totalClosedAmount = useMemo(
    () =>
      (savings.closed_items ?? []).reduce((acc, item) => {
        const amount = item.final_amount ?? item.initial_amount ?? item.offer_amount ?? 0;
        return acc + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [savings.closed_items]
  );

  const closedItemsList = useMemo(() => itemsByClosed.map((item) => toClosedSummaryListItem(item)), [itemsByClosed]);

  const withSavingsList = useMemo(() => itemsWithSavings.map((item) => toSummaryListItem(item)), [itemsWithSavings]);

  const positiveList = useMemo(() => positiveItems.map((item) => toSummaryListItem(item)), [positiveItems]);

  const negativeList = useMemo(() => negativeItems.map((item) => toSummaryListItem(item)), [negativeItems]);

  const toggleCard = (key: 'closed' | 'withSavings' | 'net' | 'lost') => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`Закрытых заявок: ${savings.total_closed_requests}`} color="primary" variant="outlined" size="small" />
        <Chip label={`С расчетом экономии: ${savings.total_with_savings}`} color="info" variant="outlined" size="small" />
        <Chip label={`С плюсом: ${positiveItems.length}`} color="success" variant="outlined" size="small" />
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
          <SavingsBalanceChart
            totalClosedAmount={totalClosedAmount}
            netSavings={savings.total_savings_amount}
            lostSavings={summary.lostSavings}
          />

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
              title="Чистая экономия"
              value={formatSignedAmount(savings.total_savings_amount)}
              valueColor={savings.total_savings_amount >= 0 ? 'success.main' : 'error.main'}
              items={positiveList}
              emptyText="Нет заявок с положительной экономией."
              isExpanded={expandedCards.net}
              onToggle={() => toggleCard('net')}
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
