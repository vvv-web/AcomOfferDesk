import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import PieChartOutlineRoundedIcon from '@mui/icons-material/PieChartOutlineRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { formatAmount } from '@shared/lib/formatters';
import type { PlanDistributionItem, PlanRequestFactMetrics, SubordinateFilterOption } from './planDashboardUtils';
import type { PlanExecutionSlice, PlanFilterOption } from './planDashboardUtils';
import { ALL_SUBORDINATES_SCOPE, formatPercent } from './planDashboardUtils';

const sectionCardSx = {
  borderRadius: 1.5,
  boxShadow: '0 3px 10px rgba(15, 23, 42, 0.04)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  backgroundColor: '#fff',
};

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

type PlanProgressVisualProps = {
  value: number;
  factAmount: number;
  remainingAmount: number;
  totalAmount: number;
  periodLabel: string;
  slices: PlanExecutionSlice[];
  selectedPlanId: number | null;
  onSliceClick: (planId: number) => void;
};

export const PlanProgressVisual = ({
  value,
  factAmount,
  remainingAmount,
  totalAmount,
  periodLabel,
  slices,
  selectedPlanId,
  onSliceClick,
}: PlanProgressVisualProps) => {
  const theme = useTheme();
  const safeValue = Math.max(0, Math.min(100, value));
  const pieRadius = 88;
  const totalSlicesValue = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0);
  let currentAngle = -90;
  const pieSegments = (totalSlicesValue > 0 ? slices : []).map((slice) => {
    const sweep = (Math.max(slice.value, 0) / totalSlicesValue) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweep;
    currentAngle = endAngle;
    return { ...slice, startAngle, endAngle };
  });

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '126px minmax(0, 1fr)', sm: '136px minmax(0, 1fr)' },
        gap: 0.5,
        alignItems: 'center',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Box
          sx={{
            position: 'relative',
            width: 116,
            height: 116,
            borderRadius: '50%',
            boxShadow: 'inset 0 0 0 1px rgba(47,111,214,0.16), 0 8px 18px rgba(31,42,68,0.12)',
          }}
        >
          <Box component="svg" viewBox="0 0 200 200" sx={{ width: '100%', height: '100%' }}>
            {(pieSegments.length > 0
              ? pieSegments
              : [
                  {
                    key: 'fact',
                    color: theme.palette.primary.main,
                    startAngle: -90,
                    endAngle: -90 + (safeValue / 100) * 360,
                    planId: -1,
                  },
                  {
                    key: 'rest',
                    color: alpha(theme.palette.primary.main, 0.18),
                    startAngle: -90 + (safeValue / 100) * 360,
                    endAngle: 270,
                    planId: -2,
                  },
                ]
            ).map((segment) => (
              <path
                key={segment.key}
                d={describeSectorPath(100, 100, pieRadius, segment.startAngle, segment.endAngle)}
                fill={segment.color}
                stroke="#ffffff"
                strokeWidth={2}
                style={{ cursor: 'pointer', opacity: selectedPlanId === null || segment.planId === -1 || selectedPlanId === segment.planId ? 1 : 0.65 }}
                onClick={() => (segment.planId > 0 ? onSliceClick(segment.planId) : undefined)}
              />
            ))}
          </Box>
          <Stack
            spacing={0.25}
            alignItems="center"
            justifyContent="center"
            sx={{
              position: 'absolute',
              inset: 16,
              borderRadius: '50%',
              backgroundColor: 'background.paper',
              boxShadow: '0 0 0 1px rgba(47,111,214,0.10)',
              textAlign: 'center',
            }}
          >
            <Typography variant="subtitle1" fontWeight={800} sx={{ fontSize: 26, lineHeight: 1.02 }}>
              {safeValue.toFixed(2)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Выполнено
            </Typography>
          </Stack>
        </Box>
      </Box>

      <Stack spacing={0.6}>
        <Stack spacing={0.55}>
          {(slices.length > 0
            ? slices.map((slice) => ({
                key: slice.key,
                label: slice.label,
                value: formatPercent(slice.progressPercent),
                color: slice.color,
                selected: selectedPlanId === slice.planId,
                onClick: () => onSliceClick(slice.planId),
              }))
            : [
                {
                  key: 'fact',
                  label: 'Факт',
                  value: formatAmount(factAmount),
                  color: theme.palette.success.main,
                  selected: false,
                  onClick: undefined,
                },
                {
                  key: 'rest',
                  label: 'Остаток',
                  value: formatAmount(remainingAmount),
                  color: theme.palette.warning.main,
                  selected: false,
                  onClick: undefined,
                },
                {
                  key: 'goal',
                  label: 'Цель',
                  value: formatAmount(totalAmount),
                  color: theme.palette.primary.main,
                  selected: false,
                  onClick: undefined,
                },
              ]).map((item) => (
            <Stack key={item.label} direction="row" justifyContent="space-between" spacing={1} alignItems="center">
              <Stack
                direction="row"
                spacing={0.65}
                alignItems="center"
                onClick={item.onClick}
                sx={{
                  cursor: item.onClick ? 'pointer' : 'default',
                  opacity: item.selected ? 1 : 0.9,
                }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.75, lineHeight: 1.05 }}>
                  {item.label}
                </Typography>
              </Stack>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10.75, lineHeight: 1.05 }}>
                {item.value}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Box
          sx={{
            borderRadius: 3,
            px: 1,
            py: 0.85,
            bgcolor: alpha(theme.palette.primary.main, 0.06),
          }}
        >
          <Stack spacing={0.35}>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <DonutLargeRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11 }}>
                Цель: {formatAmount(totalAmount)}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
              Период: {periodLabel}
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

type PlanPageHeaderProps = {
  period: string;
  selectedScopeUserId: string;
  selectedPlanId: number | null;
  subordinateOptions: SubordinateFilterOption[];
  planOptions: PlanFilterOption[];
  canCreateRootPlan: boolean;
  isMutating: boolean;
  onPeriodChange: (value: string) => void;
  onScopeChange: (value: string) => void;
  onPlanChange: (value: number | null) => void;
  onAddPlan: () => void;
};

export const PlanPageHeader = ({
  period,
  selectedScopeUserId,
  selectedPlanId,
  subordinateOptions,
  planOptions,
  canCreateRootPlan,
  isMutating,
  onPeriodChange,
  onScopeChange,
  onPlanChange,
  onAddPlan,
}: PlanPageHeaderProps) => {
  return (
    <Box
      sx={{
        px: { xs: 0.25, md: 0.5 },
        py: 0.1,
      }}
    >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={0.75}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', lg: 'center' }}
      >
        <Stack spacing={0.35} sx={{ minWidth: 0 }}>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            План экономии
          </Typography>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={0.75}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent={{ sm: 'flex-end' }}
        >
          <TextField
            type="month"
            size="small"
            label="Период"
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: '100%', sm: 152 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarMonthRoundedIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
            <InputLabel id="plan-scope-label">Сотрудник</InputLabel>
            <Select
              labelId="plan-scope-label"
              label="Сотрудник"
              value={selectedScopeUserId}
              onChange={(event) => onScopeChange(event.target.value)}
            >
              <MenuItem value={ALL_SUBORDINATES_SCOPE}>Мои + все подчиненные</MenuItem>
              {subordinateOptions.map((option) => (
                <MenuItem key={option.userId} value={option.userId}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
            <InputLabel id="plan-filter-label">План</InputLabel>
            <Select
              labelId="plan-filter-label"
              label="План"
              value={selectedPlanId === null ? '' : String(selectedPlanId)}
              onChange={(event) => onPlanChange(event.target.value ? Number(event.target.value) : null)}
            >
              <MenuItem value="">Все планы</MenuItem>
              {planOptions.map((option) => (
                <MenuItem key={option.planId} value={String(option.planId)}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {canCreateRootPlan ? (
            <Button
              variant="contained"
              onClick={onAddPlan}
              disabled={isMutating}
              startIcon={<AddRoundedIcon />}
              sx={{ minWidth: { xs: '100%', sm: 140 }, height: 33, borderRadius: 2 }}
            >
              Добавить план
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
};

type PlanKpiRowProps = {
  totalPlanAmount: number;
  totalFactAmount: number;
  totalProgressPercent: number;
  totalRemainingAmount: number;
  participantCount: number;
};

export const PlanKpiRow = ({
  totalPlanAmount,
  totalFactAmount,
  totalProgressPercent,
  totalRemainingAmount,
  participantCount,
}: PlanKpiRowProps) => {
  const theme = useTheme();

  const items = [
    {
      label: 'Общий план',
      value: formatAmount(totalPlanAmount),
      icon: <FlagRoundedIcon sx={{ color: 'primary.main' }} />,
      accent: alpha(theme.palette.primary.main, 0.12),
    },
    {
      label: 'Факт',
      value: formatAmount(totalFactAmount),
      icon: <CheckCircleOutlineRoundedIcon sx={{ color: 'success.main' }} />,
      accent: alpha(theme.palette.success.main, 0.12),
    },
    {
      label: 'Выполнение',
      value: formatPercent(totalProgressPercent),
      icon: <QueryStatsRoundedIcon sx={{ color: 'warning.main' }} />,
      accent: alpha(theme.palette.warning.main, 0.14),
    },
    {
      label: 'Остаток',
      value: formatAmount(totalRemainingAmount),
      icon: <PieChartOutlineRoundedIcon sx={{ color: '#8b5cf6' }} />,
      accent: 'rgba(139, 92, 246, 0.12)',
    },
    {
      label: 'Участники',
      value: String(participantCount),
      icon: <GroupRoundedIcon sx={{ color: 'primary.main' }} />,
      accent: alpha(theme.palette.info.main, 0.12),
    },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(5, minmax(0, 1fr))',
        },
        gap: 0.75,
      }}
    >
      {items.map((item) => (
        <Card key={item.label} sx={sectionCardSx}>
          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minHeight: 30 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '8px',
                  bgcolor: item.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </Box>
              <Stack spacing={0.15} minWidth={0}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5, lineHeight: 1 }}>
                  {item.label}
                </Typography>
                <Typography variant="subtitle2" fontWeight={800} sx={{ lineHeight: 1.05, overflowWrap: 'anywhere', fontSize: 12.75 }}>
                  {item.value}
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

type PlanAnalyticsCardsProps = {
  totalPlanAmount: number;
  totalFactAmount: number;
  totalProgressPercent: number;
  totalRemainingAmount: number;
  periodLabel: string;
  distributionItems: PlanDistributionItem[];
  executionSlices: PlanExecutionSlice[];
  selectedPlanId: number | null;
  requestFactMetrics: PlanRequestFactMetrics;
  onExecutionSliceClick: (planId: number) => void;
};

export const PlanAnalyticsCards = ({
  totalPlanAmount,
  totalFactAmount,
  totalProgressPercent,
  totalRemainingAmount,
  periodLabel,
  distributionItems,
  executionSlices,
  selectedPlanId,
  requestFactMetrics,
  onExecutionSliceClick,
}: PlanAnalyticsCardsProps) => {
  const theme = useTheme();

  const requestRows = [
    { label: 'Всего заявок', value: requestFactMetrics.totalRequests },
    { label: 'Распределенные', value: requestFactMetrics.distributedRequests },
    { label: 'Факт по заявкам', value: requestFactMetrics.requestFactAmount, format: 'amount' as const },
    { label: 'Выполнение', value: requestFactMetrics.completionPercent, format: 'percent' as const },
    { label: 'Нераспределенные заявки', value: requestFactMetrics.unallocatedRequests },
    { label: 'Сумма', value: requestFactMetrics.unallocatedAmount, format: 'amount' as const },
  ];

  const distributionTotal = distributionItems.reduce((sum, item) => sum + item.amount, 0);
  const ringRadius = 46;
  let currentAngle = -90;
  const distributionSegments = distributionItems.map((item) => {
    const sweep = (Math.max(item.amount, 0) / Math.max(distributionTotal, 1)) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweep;
    currentAngle = endAngle;
    return { ...item, startAngle, endAngle };
  });

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
        gap: 0.5,
      }}
    >
      <Card sx={sectionCardSx}>
        <CardContent sx={{ p: 0.95, height: { xs: 'auto', xl: 208 }, '&:last-child': { pb: 0.95 } }}>
          <Stack spacing={1.15} sx={{ height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={800}>
              Выполнение плана
            </Typography>
            <PlanProgressVisual
              value={totalProgressPercent}
              factAmount={totalFactAmount}
              remainingAmount={totalRemainingAmount}
              totalAmount={totalPlanAmount}
              periodLabel={periodLabel}
              slices={executionSlices}
              selectedPlanId={selectedPlanId}
              onSliceClick={onExecutionSliceClick}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card sx={sectionCardSx}>
        <CardContent sx={{ p: 0.95, height: { xs: 'auto', xl: 208 }, '&:last-child': { pb: 0.95 } }}>
          <Stack spacing={1.1} sx={{ height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={800}>
              Распределение плана по сотрудникам
            </Typography>
            {distributionItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Нет данных для распределения по текущей выборке.
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: '134px minmax(0, 1fr)', gap: 0.8, alignItems: 'center' }}>
                <Stack spacing={0.5} alignItems="center">
                  <Box sx={{ position: 'relative', width: 120, height: 120 }}>
                    <Box
                      component="svg"
                      viewBox="0 0 200 200"
                      sx={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        boxShadow: 'inset 0 0 0 1px rgba(47,111,214,0.16), 0 8px 18px rgba(31,42,68,0.12)',
                      }}
                    >
                      {distributionSegments.map((item) => (
                        <path
                          key={item.key}
                          d={describeSectorPath(100, 100, ringRadius * 1.9, item.startAngle, item.endAngle)}
                          fill={item.color}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      ))}
                    </Box>
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 18,
                        borderRadius: '50%',
                        backgroundColor: 'background.paper',
                        boxShadow: '0 0 0 1px rgba(47,111,214,0.10)',
                      }}
                    />
                    <Stack spacing={0.1} alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0 }}>
                      <Typography variant="caption" color="text.secondary">
                        Всего
                      </Typography>
                      <Typography variant="caption" fontWeight={800} sx={{ textAlign: 'center', px: 1, fontSize: 11.5 }}>
                        {formatAmount(totalPlanAmount)}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
                <Stack spacing={0.5} sx={{ overflow: 'auto' }}>
                  {distributionItems.map((item) => (
                    <Stack key={item.key} spacing={0.2}>
                      <Stack direction="row" justifyContent="space-between" spacing={0.7} alignItems="center">
                        <Stack direction="row" spacing={0.8} alignItems="center" minWidth={0}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
                          <Typography variant="caption" noWrap sx={{ fontSize: 11 }}>
                            {item.label}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap" sx={{ fontSize: 10.5 }}>
                          {formatAmount(item.factAmount)} / {formatAmount(item.planAmount)}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={item.progressPercent}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 999,
                            backgroundColor: item.color,
                          },
                        }}
                      />
                      <Stack direction="row" justifyContent="space-between" spacing={0.7}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
                          100% плана
                        </Typography>
                        <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10.5 }}>
                          {formatPercent(item.progressPercent)}
                        </Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={sectionCardSx}>
        <CardContent sx={{ p: 0.95, height: { xs: 'auto', xl: 208 }, '&:last-child': { pb: 0.95 } }}>
          <Stack spacing={1.1} sx={{ height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={800}>
              Заявки, формирующие факт
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.55 }}>
              {requestRows.map((row) => (
                <Stack
                  key={row.label}
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    borderRadius: 1.5,
                    px: 0.75,
                    py: 0.55,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                  }}
                >
                  <Stack direction="row" spacing={0.55} alignItems="center" minWidth={0}>
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: '8px',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ReceiptLongRoundedIcon sx={{ fontSize: 13 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.75, lineHeight: 1.05 }}>
                      {row.label}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" fontWeight={800} whiteSpace="nowrap" sx={{ fontSize: 10.75, lineHeight: 1.05 }}>
                    {row.value === null || row.value === undefined
                      ? '—'
                      : row.format === 'amount'
                        ? formatAmount(row.value)
                        : row.format === 'percent'
                          ? formatPercent(row.value)
                          : String(row.value)}
                  </Typography>
                </Stack>
              ))}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export const planSectionCardSx = sectionCardSx;
export const hierarchyTitleIcon = <AccountTreeRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />;
