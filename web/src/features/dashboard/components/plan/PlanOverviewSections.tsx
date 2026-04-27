import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DonutLargeRoundedIcon from "@mui/icons-material/DonutLargeRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import PieChartOutlineRoundedIcon from "@mui/icons-material/PieChartOutlineRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
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
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { formatAmount } from "@shared/lib/formatters";
import type {
  PlanDistributionItem,
  PlanExecutionSlice,
  PlanRequestFactMetrics,
  SubordinateFilterOption,
} from "./planDashboardUtils";
import { ALL_SUBORDINATES_SCOPE, formatPercent } from "./planDashboardUtils";

const sectionCardSx = {
  borderRadius: 2,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.035)",
  border: "1px solid rgba(226, 232, 240, 0.95)",
  backgroundColor: "#ffffff",
};

const toRadians = (angle: number) => (Math.PI / 180) * angle;

const trimTrailingZeros = (value: string) =>
  value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");

const formatCompactAmount = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${trimTrailingZeros((value / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1))} млрд`;
  }
  if (abs >= 1_000_000) {
    return `${trimTrailingZeros((value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1))} млн`;
  }
  if (abs >= 1_000) {
    return `${trimTrailingZeros((value / 1_000).toFixed(abs >= 100_000 ? 0 : 1))} тыс`;
  }
  return formatAmount(value);
};

const describeSectorPath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) => {
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
  const totalSlicesValue = slices.reduce(
    (sum, slice) => sum + Math.max(slice.value, 0),
    0,
  );
  let currentAngle = -90;
  const pieSegments = (totalSlicesValue > 0 ? slices : []).map((slice) => {
    const sweep = (Math.max(slice.value, 0) / totalSlicesValue) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweep;
    currentAngle = endAngle;
    return { ...slice, startAngle, endAngle };
  });

  const legendItems =
    slices.length > 0
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
            key: "fact",
            label: "Факт",
            value: formatAmount(factAmount),
            color: theme.palette.success.main,
            selected: false,
            onClick: undefined,
          },
          {
            key: "rest",
            label: "Остаток",
            value: formatAmount(remainingAmount),
            color: theme.palette.warning.main,
            selected: false,
            onClick: undefined,
          },
          {
            key: "goal",
            label: "Цель",
            value: formatAmount(totalAmount),
            color: theme.palette.primary.main,
            selected: false,
            onClick: undefined,
          },
        ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "140px minmax(0, 1fr)" },
        gap: { xs: 1.1, sm: 1.25 },
        alignItems: "center",
      }}
    >
      
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        
        <Box
          sx={{
            position: "relative",
            width: 124,
            height: 124,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.08)",
          }}
        >
          
          <Box
            component="svg"
            viewBox="0 0 200 200"
            sx={{ width: "100%", height: "100%" }}
          >
            {(pieSegments.length > 0
              ? pieSegments
              : [
                  {
                    key: "fact",
                    color: theme.palette.primary.main,
                    startAngle: -90,
                    endAngle: -90 + (safeValue / 100) * 360,
                    planId: -1,
                  },
                  {
                    key: "rest",
                    color: alpha(theme.palette.primary.main, 0.18),
                    startAngle: -90 + (safeValue / 100) * 360,
                    endAngle: 270,
                    planId: -2,
                  },
                ]
            ).map((segment) => (
              <path
                key={segment.key}
                d={describeSectorPath(
                  100,
                  100,
                  pieRadius,
                  segment.startAngle,
                  segment.endAngle,
                )}
                fill={segment.color}
                stroke="#ffffff"
                strokeWidth={2}
                style={{
                  cursor: "pointer",
                  opacity:
                    selectedPlanId === null ||
                    segment.planId < 0 ||
                    selectedPlanId === segment.planId
                      ? 1
                      : 0.64,
                }}
                onClick={() =>
                  segment.planId > 0 ? onSliceClick(segment.planId) : undefined
                }
              />
            ))}
          </Box>
          <Stack
            spacing={0.3}
            alignItems="center"
            justifyContent="center"
            sx={{
              position: "absolute",
              inset: 16,
              borderRadius: "50%",
              backgroundColor: "background.paper",
              boxShadow: "0 0 0 1px rgba(59,130,246,0.08)",
              textAlign: "center",
            }}
          >
            
            <Typography
              variant="subtitle1"
              fontWeight={800}
              sx={{ fontSize: 18, lineHeight: 1.05 }}
            >
              {safeValue.toFixed(2)}%
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: 11 }}
            >
              
              Выполнено
            </Typography>
          </Stack>
        </Box>
      </Box>
      <Stack spacing={1}>
        
        <Stack spacing={0.8}>
          {legendItems.map((item) => (
            <Stack
              key={item.key}
              direction="row"
              justifyContent="space-between"
              spacing={1}
              alignItems="center"
            >
              
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                onClick={item.onClick}
                sx={{
                  cursor: item.onClick ? "pointer" : "default",
                  opacity: item.selected ? 1 : 0.94,
                }}
              >
                
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: item.color,
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: 12, lineHeight: 1.1 }}
                >
                  {item.label}
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{ fontSize: 12, lineHeight: 1.1 }}
              >
                {item.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Box
          sx={{
            borderRadius: 2.5,
            px: 1.1,
            py: 0.95,
            bgcolor: "#f7fbff",
            border: "1px solid rgba(219, 234, 254, 0.9)",
          }}
        >
          
          <Stack spacing={0.4}>
            
            <Stack direction="row" spacing={0.7} alignItems="center">
              
              <DonutLargeRoundedIcon
                sx={{ fontSize: 18, color: "primary.main" }}
              />
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{ fontSize: 12 }}
              >
                Цель: {formatAmount(totalAmount)}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: 12 }}
            >
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
  subordinateOptions: SubordinateFilterOption[];
  canCreateRootPlan: boolean;
  isMutating: boolean;
  onPeriodChange: (value: string) => void;
  onScopeChange: (value: string) => void;
  onAddPlan: () => void;
};

export const PlanPageHeader = ({
  period,
  selectedScopeUserId,
  subordinateOptions,
  canCreateRootPlan,
  isMutating,
  onPeriodChange,
  onScopeChange,
  onAddPlan,
}: PlanPageHeaderProps) => {
  return (
    <Box sx={{ px: { xs: 0, md: 0.15 }, py: 0 }}>
      
      <Stack
        direction={{ xs: "column", xl: "row" }}
        spacing={1.1}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", xl: "center" }}
      >
        
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          
          <Typography
            variant="h5"
            fontWeight={800}
            sx={{ lineHeight: 1.1, fontSize: { xs: 25, md: 26 } }}
          >
            
            План экономии
          </Typography>
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent={{ sm: "flex-end" }}
          useFlexGap
          flexWrap="wrap"
        >
          
          <TextField
            type="month"
            size="small"
            label="Период"
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{
              minWidth: { xs: "100%", sm: 190 },
              "& .MuiOutlinedInput-root": {
                minHeight: 40,
                bgcolor: "rgba(255,255,255,0.96)",
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  
                  <CalendarMonthRoundedIcon
                    sx={{ color: "text.secondary", fontSize: 18 }}
                  />
                </InputAdornment>
              ),
            }}
          />
          <FormControl
            size="small"
            sx={{
              minWidth: { xs: "100%", sm: 256 },
              "& .MuiOutlinedInput-root": {
                minHeight: 40,
                bgcolor: "rgba(255,255,255,0.96)",
              },
            }}
          >
            
            <InputLabel id="plan-scope-label">Сотрудник</InputLabel>
            <Select
              labelId="plan-scope-label"
              label="Сотрудник"
              value={selectedScopeUserId}
              onChange={(event) => onScopeChange(event.target.value)}
            >
              
              <MenuItem value={ALL_SUBORDINATES_SCOPE}>
                Мои + все подчиненные
              </MenuItem>
              {subordinateOptions.map((option) => (
                <MenuItem key={option.userId} value={option.userId}>
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
              sx={{
                minWidth: { xs: "100%", sm: 164 },
                minHeight: 40,
                borderRadius: 2,
                px: 2,
              }}
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
      label: "Общий план",
      value: formatAmount(totalPlanAmount),
      icon: <FlagRoundedIcon sx={{ color: "primary.main" }} />,
      accent: alpha(theme.palette.primary.main, 0.1),
    },
    {
      label: "Факт",
      value: formatAmount(totalFactAmount),
      icon: <CheckCircleOutlineRoundedIcon sx={{ color: "success.main" }} />,
      accent: alpha(theme.palette.success.main, 0.12),
    },
    {
      label: "Выполнение",
      value: formatPercent(totalProgressPercent),
      icon: <QueryStatsRoundedIcon sx={{ color: "warning.main" }} />,
      accent: alpha(theme.palette.warning.main, 0.14),
    },
    {
      label: "Остаток",
      value: formatAmount(totalRemainingAmount),
      icon: <PieChartOutlineRoundedIcon sx={{ color: "#8b5cf6" }} />,
      accent: "rgba(139, 92, 246, 0.12)",
    },
    {
      label: "Участники",
      value: String(participantCount),
      icon: <GroupRoundedIcon sx={{ color: "info.main" }} />,
      accent: alpha(theme.palette.info.main, 0.12),
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(5, minmax(0, 1fr))",
        },
        gap: 1,
      }}
    >
      {items.map((item) => (
        <Card key={item.label} sx={sectionCardSx}>
          
          <CardContent sx={{ p: 1.05, "&:last-child": { pb: 1.05 } }}>
            
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minHeight: 42 }}
            >
              
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  bgcolor: item.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </Box>
              <Stack spacing={0.2} minWidth={0}>
                
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: 12, lineHeight: 1.1 }}
                >
                  {item.label}
                </Typography>
                <Typography
                  variant="subtitle2"
                  fontWeight={800}
                  sx={{
                    lineHeight: 1.05,
                    overflowWrap: "anywhere",
                    fontSize: { xs: 18, xl: 17.5 },
                  }}
                >
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
  onDistributionItemClick: (planId: number) => void;
  onClearPlanSelection: () => void;
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
  onDistributionItemClick,
  onClearPlanSelection,
}: PlanAnalyticsCardsProps) => {
  const theme = useTheme();

  const requestRows = [
    {
      label: "Экономия по заявкам",
      value: requestFactMetrics.requestFactAmount,
      format: "amount" as const,
    },
    {
      label: "Выполнение",
      value: requestFactMetrics.completionPercent,
      format: "percent" as const,
    },
  ];

  const distributionTotal = distributionItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const ringRadius = 46;
  let currentAngle = -90;
  const distributionSegments = distributionItems.map((item) => {
    const sweep =
      (Math.max(item.amount, 0) / Math.max(distributionTotal, 1)) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweep;
    currentAngle = endAngle;
    return { ...item, startAngle, endAngle };
  });

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "repeat(2, minmax(0, 1fr))",
          xl: "repeat(3, minmax(0, 1fr))",
        },
        gap: 1,
      }}
    >
      
      <Card sx={{ ...sectionCardSx, order: 2 }}>
        
        <CardContent
          sx={{
            p: 1.05,
            height: { xs: "auto", xl: 204 },
            "&:last-child": { pb: 1.05 },
          }}
        >
          
          <Stack spacing={1.1} sx={{ height: "100%" }}>
            
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={1}
            >
              
              <Typography variant="subtitle1" fontWeight={800}>
                
                Распределение плана по сотрудникам
              </Typography>
              {selectedPlanId !== null ? (
                <Button
                  size="small"
                  variant="text"
                  onClick={onClearPlanSelection}
                >
                  
                  Сбросить
                </Button>
              ) : null}
            </Stack>
            {distributionItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                
                Нет данных для распределения по текущей выборке.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "150px minmax(0, 1fr)",
                  },
                  gap: 1,
                  alignItems: "center",
                }}
              >
                
                <Stack spacing={0.5} alignItems="center">
                  
                  <Box sx={{ position: "relative", width: 132, height: 132 }}>
                    
                    <Box
                      component="svg"
                      viewBox="0 0 200 200"
                      sx={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                        boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.08)",
                        cursor: "pointer",
                      }}
                    >
                      {distributionSegments.map((item) => (
                        <path
                          key={item.key}
                          d={describeSectorPath(
                            100,
                            100,
                            ringRadius * 1.9,
                            item.startAngle,
                            item.endAngle,
                          )}
                          fill={item.color}
                          stroke={
                            selectedPlanId === item.planId &&
                            item.planId !== null
                              ? theme.palette.primary.main
                              : "#ffffff"
                          }
                          strokeWidth={
                            selectedPlanId === item.planId &&
                            item.planId !== null
                              ? 3
                              : 2
                          }
                          style={{
                            cursor: item.planId ? "pointer" : "default",
                            opacity:
                              selectedPlanId === null ||
                              item.planId === null ||
                              selectedPlanId === item.planId
                                ? 1
                                : 0.64,
                          }}
                          onClick={() =>
                            item.planId
                              ? onDistributionItemClick(item.planId)
                              : undefined
                          }
                        >
                          <title>{item.label}</title>
                        </path>
                      ))}
                    </Box>
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 20,
                        borderRadius: "50%",
                        backgroundColor: "background.paper",
                        boxShadow: "0 0 0 1px rgba(59,130,246,0.08)",
                        pointerEvents: "none",
                      }}
                    />
                    <Stack
                      spacing={0.15}
                      alignItems="center"
                      justifyContent="center"
                      sx={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                      }}
                    >
                      
                      <Typography
                        variant="h5"
                        fontWeight={800}
                        title={formatAmount(totalPlanAmount)}
                        sx={{
                          textAlign: "center",
                          px: 1,
                          fontSize:
                            formatCompactAmount(totalPlanAmount).length > 10
                              ? 15
                              : 18,
                          lineHeight: 1.05,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 98,
                        }}
                      >
                        {formatCompactAmount(totalPlanAmount)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: 11, textTransform: "lowercase" }}
                      >
                        
                        всего
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
                <Stack spacing={0.7} sx={{ overflow: "auto" }}>
                  {distributionItems.map((item) => (
                    <Stack key={item.key} spacing={0.45}>
                      
                      <Stack
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        minWidth={0}
                      >
                        
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor: item.color,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant="body2"
                          noWrap
                          fontWeight={700}
                          sx={{ fontSize: 12.5, lineHeight: 1.2 }}
                        >
                          {item.label}
                        </Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={1.1}
                        alignItems="center"
                        onClick={() =>
                          item.planId
                            ? onDistributionItemClick(item.planId)
                            : undefined
                        }
                        sx={{
                          cursor: item.planId ? "pointer" : "default",
                          opacity:
                            selectedPlanId === null ||
                            item.planId === null ||
                            selectedPlanId === item.planId
                              ? 1
                              : 0.72,
                        }}
                      >
                        
                        <LinearProgress
                          variant="determinate"
                          value={item.percent}
                          sx={{
                            flex: 1,
                            height: 8,
                            borderRadius: 999,
                            bgcolor: "#e5e7eb",
                            "& .MuiLinearProgress-bar": {
                              borderRadius: 999,
                              backgroundColor: item.color,
                            },
                          }}
                        />
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontSize: 12.5, minWidth: 52 }}
                        >
                          {formatPercent(item.percent)}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          sx={{
                            fontSize: 12.5,
                            minWidth: 108,
                            textAlign: "right",
                          }}
                        >
                          {formatAmount(item.planAmount)}
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
      <Card sx={{ ...sectionCardSx, order: 1 }}>
        
        <CardContent
          sx={{
            p: 1.05,
            height: { xs: "auto", xl: 204 },
            "&:last-child": { pb: 1.05 },
          }}
        >
          
          <Stack spacing={1.15} sx={{ height: "100%" }}>
            
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={1}
            >
              
              <Typography variant="subtitle1" fontWeight={800}>
                
                Выполнение плана
              </Typography>
              {selectedPlanId !== null ? (
                <Button
                  size="small"
                  variant="text"
                  onClick={onClearPlanSelection}
                >
                  
                  Сбросить
                </Button>
              ) : null}
            </Stack>
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
      <Card sx={{ ...sectionCardSx, order: 3 }}>
        
        <CardContent
          sx={{
            p: 1.05,
            height: { xs: "auto", xl: 204 },
            "&:last-child": { pb: 1.05 },
          }}
        >
          
          <Stack spacing={1.1} sx={{ height: "100%" }}>
            
            <Typography variant="subtitle1" fontWeight={800}>
              Заявки, формирующие экономию
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 0.85,
              }}
            >
              {requestRows.map((row) => (
                <Stack
                  key={row.label}
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    borderRadius: 2.5,
                    px: 0.95,
                    py: 0.8,
                    bgcolor: "#ffffff",
                    border: "1px solid rgba(226, 232, 240, 0.8)",
                  }}
                >
                  
                  <Stack
                    direction="row"
                    spacing={0.6}
                    alignItems="center"
                    minWidth={0}
                  >
                    
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: "10px",
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: "primary.main",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      
                      <ReceiptLongRoundedIcon sx={{ fontSize: 16 }} />
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: 11.5, lineHeight: 1.15 }}
                    >
                      {row.label}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="caption"
                    fontWeight={800}
                    whiteSpace="nowrap"
                    sx={{ fontSize: 12, lineHeight: 1.1 }}
                  >
                    {row.value === null || row.value === undefined
                      ? "—"
                      : row.format === "amount"
                        ? formatAmount(row.value)
                        : formatPercent(row.value)}
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
export const hierarchyTitleIcon = (
  <AccountTreeRoundedIcon sx={{ color: "primary.main", fontSize: 22 }} />
);
