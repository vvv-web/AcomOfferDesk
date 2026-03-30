import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  SvgIcon,
  Typography,
  useTheme
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getResponsibilityDashboard,
  type ResponsibilityEmployeeNode,
  type ResponsibilityStatusCounter,
  type ResponsibilityDashboardRequest,
  type ResponsibilityUpcomingUnavailability
} from '@shared/api/users/getResponsibilityDashboard';
import { useAuth } from '@app/providers/AuthProvider';
import { updateRequestDetails } from '@shared/api/requests/updateRequestDetails';
import { ROLE } from '@shared/constants/roles';
import { UnavailableAwareMenuItem } from '@shared/components/UnavailableAwareMenuItem';
import { formatUnavailabilityDate, getUnavailabilityStatusLabel, getUnavailabilityTooltip, type UnavailabilityPeriodInfo } from '@shared/lib/unavailability';

const STATUS_LABELS: Record<string, string> = {
  open: 'Сбор КП',
  review: 'Анализ КП'
};

type AssignmentState = Record<number, string>;
type ExpandedState = Record<string, boolean>;
type StatusTotals = Record<string, number>;

const ChevronUpIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fontSize: 20 }}>
    <path d="M7.41 14.59L12 10l4.59 4.59L18 13.17 12 7.17l-6 6z" />
  </SvgIcon>
);

const ChevronDownIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fontSize: 20 }}>
    <path d="M7.41 8.41L12 13l4.59-4.59L18 9.83l-6 6-6-6z" />
  </SvgIcon>
);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDaysUntil = (value: string) => {
  const targetDate = new Date(value);
  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }

  const today = startOfDay(new Date());
  const target = startOfDay(targetDate);
  return Math.round((target.getTime() - today.getTime()) / MS_IN_DAY);
};

const getRelativeAvailabilityLabel = (value: string) => {
  const daysUntil = getDaysUntil(value);
  if (daysUntil === null) {
    return null;
  }

  if (daysUntil <= 0) {
    return 'сегодня';
  }

  if (daysUntil === 1) {
    return 'завтра';
  }

  if (daysUntil === 2) {
    return 'послезавтра';
  }

  return `через ${daysUntil} дн.`;
};

const getUpcomingUrgency = (value: string) => {
  const daysUntil = getDaysUntil(value);
  if (daysUntil === null) {
    return 'planned' as const;
  }

  if (daysUntil <= 7) {
    return 'soon' as const;
  }

  return 'planned' as const;
};

const getActiveUnavailability = (
  userId: string,
  periods: Array<{ user_id: string; status: string; started_at: string; ended_at: string }>
): UnavailabilityPeriodInfo | null => {
  const now = new Date();
  const activePeriod = periods.find((item) => {
    if (item.user_id !== userId) {
      return false;
    }

    const startedAt = new Date(item.started_at);
    const endedAt = new Date(item.ended_at);
    return startedAt <= now && endedAt >= now;
  });

  if (!activePeriod) {
    return null;
  }

  return {
    status: activePeriod.status,
    startedAt: activePeriod.started_at,
    endedAt: activePeriod.ended_at
  };
};

const toPeriodInfo = (period: ResponsibilityUpcomingUnavailability): UnavailabilityPeriodInfo => ({
  status: period.status,
  startedAt: period.started_at,
  endedAt: period.ended_at
});

const formatUnavailabilityRange = (period: UnavailabilityPeriodInfo) =>
  `${formatUnavailabilityDate(period.startedAt)} — ${formatUnavailabilityDate(period.endedAt)}`;

const formatUnavailabilitySummary = (fullName: string, period: UnavailabilityPeriodInfo, prefix: string) => {
  const relativeLabel = getRelativeAvailabilityLabel(period.startedAt);
  const suffix = relativeLabel ? `, ${relativeLabel}` : '';
  const prefixPart = prefix ? `${prefix}: ` : '';
  return `${prefixPart}${fullName}, ${getUnavailabilityStatusLabel(period.status)} (${formatUnavailabilityRange(period)}${suffix})`;
};

const getRequestOwnerWarningTooltip = ({
  activePeriod,
  upcomingPeriod,
}: {
  activePeriod: UnavailabilityPeriodInfo | null;
  upcomingPeriod: UnavailabilityPeriodInfo | null;
}) => {
  if (activePeriod) {
    return `Сотрудник сейчас недоступен. ${getUnavailabilityTooltip(activePeriod)}`;
  }

  if (upcomingPeriod) {
    return `Скоро будет недоступен. ${getUnavailabilityTooltip(upcomingPeriod)}`;
  }

  return null;
};

const flattenEmployees = (nodes: ResponsibilityEmployeeNode[]): ResponsibilityEmployeeNode[] =>
  nodes.flatMap((node) => [node, ...flattenEmployees(node.children)]);

const getNodeTotals = (statuses: ResponsibilityStatusCounter[]): StatusTotals =>
  statuses.reduce<StatusTotals>((acc, item) => {
    acc[item.status] = item.count;
    return acc;
  }, {});

const sumTotals = (totals: StatusTotals): number => Object.values(totals).reduce((acc, count) => acc + count, 0);

const mergeTotals = (left: StatusTotals, right: StatusTotals): StatusTotals => {
  const merged: StatusTotals = { ...left };
  for (const [status, count] of Object.entries(right)) {
    merged[status] = (merged[status] ?? 0) + count;
  }
  return merged;
};

const collectDescendantTotals = (node: ResponsibilityEmployeeNode): StatusTotals => {
  return node.children.reduce<StatusTotals>((acc, child) => {
    const childOwn = getNodeTotals(child.statuses);
    const childDesc = collectDescendantTotals(child);
    return mergeTotals(acc, mergeTotals(childOwn, childDesc));
  }, {});
};

const collectGlobalTotals = (nodes: ResponsibilityEmployeeNode[]): StatusTotals => {
  return nodes.reduce<StatusTotals>((acc, node) => {
    const own = getNodeTotals(node.statuses);
    const descendants = collectDescendantTotals(node);
    return mergeTotals(acc, mergeTotals(own, descendants));
  }, {});
};

const SegmentedProgressBar = ({
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

const CircularProcessChart = ({ totals, statusColors }: { totals: StatusTotals; statusColors: Record<string, string> }) => {
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

const EmployeeWorkloadChart = ({
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

const EmployeeNodeCard = ({
  node,
  level,
  expanded,
  onToggle,
  statusColors,
  activeUnavailabilityByUser,
  upcomingUnavailabilityByUser
}: {
  node: ResponsibilityEmployeeNode;
  level: number;
  expanded: ExpandedState;
  onToggle: (userId: string) => void;
  statusColors: Record<string, string>;
  activeUnavailabilityByUser: Record<string, UnavailabilityPeriodInfo>;
  upcomingUnavailabilityByUser: Record<string, UnavailabilityPeriodInfo>;
}) => {
  const ownTotals = getNodeTotals(node.statuses);
  const subordinatesTotals = collectDescendantTotals(node);
  const hasSubordinates = node.children.length > 0;
  const isExpanded = expanded[node.user_id] ?? false;
  const activeUnavailability = activeUnavailabilityByUser[node.user_id] ?? null;
  const upcomingUnavailability = upcomingUnavailabilityByUser[node.user_id] ?? null;
  const upcomingUrgency = upcomingUnavailability ? getUpcomingUrgency(upcomingUnavailability.startedAt) : null;
  const upcomingRelativeLabel = upcomingUnavailability ? getRelativeAvailabilityLabel(upcomingUnavailability.startedAt) : null;

  return (
    <Card
      variant="outlined"
      sx={{
        ml: level * 2,
        borderRadius: 2,
        borderColor: 'divider',
        background: level === 0 ? 'rgba(47,111,214,0.06)' : 'background.paper'
      }}
    >
      <CardContent sx={{ pb: '16px !important' }}>
        <Stack spacing={1.2}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
            <Stack spacing={0.5}>
              <Typography fontWeight={700}>{node.full_name || node.user_id}</Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {activeUnavailability ? (
                  <Chip
                    size="small"
                    color="error"
                    variant="outlined"
                    label={`${getUnavailabilityStatusLabel(activeUnavailability.status)} до ${formatUnavailabilityDate(activeUnavailability.endedAt)}`}
                  />
                ) : null}
                {upcomingUnavailability ? (
                  <Chip
                    size="small"
                    color={upcomingUrgency === 'soon' ? 'warning' : 'default'}
                    variant="outlined"
                    label={`${getUnavailabilityStatusLabel(upcomingUnavailability.status)} с ${formatUnavailabilityDate(upcomingUnavailability.startedAt)}`}
                  />
                ) : null}
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip size="small" label={node.role_name} />
                <Typography variant="caption" color="text.secondary">
                  В работе: {sumTotals(ownTotals)}
                </Typography>
                {hasSubordinates ? (
                  <Typography variant="caption" color="text.secondary">
                    Подчинённые: {sumTotals(subordinatesTotals)}
                  </Typography>
                ) : null}
              </Stack>
            </Stack>
            {hasSubordinates ? (
              <Tooltip title={isExpanded ? 'Свернуть' : 'Развернуть'}>
                <IconButton
                  size="small"
                  onClick={() => onToggle(node.user_id)}
                  sx={{
                    p: 0,
                    color: 'primary.main',
                    backgroundColor: 'transparent',
                    border: 'none',
                    '&:hover': { backgroundColor: 'transparent' }
                  }}
                >
                  {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="body2" fontWeight={600}>
              Личная загрузка
            </Typography>
            <SegmentedProgressBar totals={ownTotals} statusColors={statusColors} />
            {activeUnavailability ? (
              <Typography variant="caption" color="error.main">
                Сейчас недоступен: {getUnavailabilityStatusLabel(activeUnavailability.status)} ({formatUnavailabilityRange(activeUnavailability)})
              </Typography>
            ) : null}
            {upcomingUnavailability ? (
              <Typography variant="caption" color={upcomingUrgency === 'soon' ? 'warning.main' : 'text.secondary'}>
                Будет недоступен: {getUnavailabilityStatusLabel(upcomingUnavailability.status)} ({formatUnavailabilityRange(upcomingUnavailability)})
                {upcomingRelativeLabel ? `, ${upcomingRelativeLabel}` : ''}
              </Typography>
            ) : null}
          </Stack>

          {hasSubordinates ? (
            <Stack spacing={1}>
              <Typography variant="body2" fontWeight={600}>
                Загрузка подчинённых (суммарно)
              </Typography>
              <SegmentedProgressBar totals={subordinatesTotals} statusColors={statusColors} />
            </Stack>
          ) : null}
        </Stack>
      </CardContent>

      {hasSubordinates && isExpanded ? (
        <Stack spacing={1.2} sx={{ pb: 2, pr: 2, pl: 2 }}>
          {node.children.map((child) => (
            <EmployeeNodeCard
              key={child.user_id}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              statusColors={statusColors}
              activeUnavailabilityByUser={activeUnavailabilityByUser}
              upcomingUnavailabilityByUser={upcomingUnavailabilityByUser}
            />
          ))}
        </Stack>
      ) : null}
    </Card>
  );
};

export const ProjectManagerDashboard = () => {
  const { session } = useAuth();
  const theme = useTheme();
  const statusColors = useMemo<Record<string, string>>(() => ({
    open: theme.palette.dashboard.status.open,
    review: theme.palette.dashboard.status.review
  }), [theme]);
  const workloadColors = useMemo(() => theme.palette.dashboard.workload, [theme]);
  const isLeadEconomist = session?.roleId === ROLE.LEAD_ECONOMIST;

  const [tree, setTree] = useState<ResponsibilityEmployeeNode[]>([]);
  const [unassignedRequests, setUnassignedRequests] = useState<ResponsibilityDashboardRequest[]>([]);
  const [myRequests, setMyRequests] = useState<ResponsibilityDashboardRequest[]>([]);
  const [assignedRequests, setAssignedRequests] = useState<ResponsibilityDashboardRequest[]>([]);
  const [activeUnavailability, setActiveUnavailability] = useState<ResponsibilityUpcomingUnavailability[]>([]);
  const [upcomingUnavailability, setUpcomingUnavailability] = useState<Array<{
    user_id: string;
    full_name: string | null;
    role_name: string;
    status: string;
    started_at: string;
    ended_at: string;
  }>>([]);
  const [requestsTab, setRequestsTab] = useState<'unassigned' | 'mine' | 'assigned'>('unassigned');
  const [assignmentState, setAssignmentState] = useState<AssignmentState>({});
  const [expandedNodes, setExpandedNodes] = useState<ExpandedState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dismissedWarningKey, setDismissedWarningKey] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getResponsibilityDashboard();
      setTree(response.tree);
      setUnassignedRequests(response.unassignedRequests);
      setMyRequests(response.myRequests);
      setAssignedRequests(response.assignedRequests);
      setActiveUnavailability(response.activeUnavailability);
      setUpcomingUnavailability(response.upcomingUnavailability);
      setExpandedNodes((prev) => {
        const next = { ...prev };
        for (const node of flattenEmployees(response.tree)) {
          if (node.children.length > 0 && next[node.user_id] === undefined) {
            next[node.user_id] = false;
          }
        }
        return next;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить дашборд');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!isLeadEconomist && requestsTab === 'mine') {
      setRequestsTab('unassigned');
    }
  }, [isLeadEconomist, requestsTab]);

  const allSubordinates = useMemo(() => flattenEmployees(tree), [tree]);
  const globalTotals = useMemo(() => collectGlobalTotals(tree), [tree]);
  const inProgressTotal = useMemo(() => sumTotals(globalTotals), [globalTotals]);

  const pendingAssignmentIds = useMemo(
    () => Object.entries(assignmentState).filter(([, ownerId]) => Boolean(ownerId)).map(([requestId]) => Number(requestId)),
    [assignmentState]
  );

  const employeeNameById = useMemo(() => {
    return allSubordinates.reduce<Record<string, string>>((acc, employee) => {
      acc[employee.user_id] = employee.full_name || employee.user_id;
      return acc;
    }, {});
  }, [allSubordinates]);

  const resolveAssigneeLabel = useCallback((request: ResponsibilityDashboardRequest, userId: string) => {
    if (!userId) {
      return 'Выберите ответственного';
    }

    const employee = allSubordinates.find((item) => item.user_id === userId);
    if (employee) {
      return `${employee.full_name || employee.user_id} (${employee.role_name})`;
    }

    return request.owner_full_name || employeeNameById[userId] || userId;
  }, [allSubordinates, employeeNameById]);

  const activeUnavailabilityByUser = useMemo(
    () =>
      activeUnavailability.reduce<Record<string, UnavailabilityPeriodInfo>>((acc, period) => {
        acc[period.user_id] = toPeriodInfo(period);
        return acc;
      }, {}),
    [activeUnavailability]
  );

  const upcomingUnavailabilityByUser = useMemo(
    () =>
      upcomingUnavailability.reduce<Record<string, UnavailabilityPeriodInfo>>((acc, period) => {
        if (!acc[period.user_id]) {
          acc[period.user_id] = toPeriodInfo(period);
        }
        return acc;
      }, {}),
    [upcomingUnavailability]
  );

  const warningGroups = useMemo(
    () => ({
      active: activeUnavailability.map((period) => ({
        key: `active-${period.user_id}-${period.started_at}-${period.ended_at}`,
        text: formatUnavailabilitySummary(period.full_name || period.user_id, toPeriodInfo(period), '')
      })),
      upcoming: upcomingUnavailability.flatMap((period) => {
        const daysUntil = getDaysUntil(period.started_at);
        if (daysUntil !== 7 && (daysUntil === null || daysUntil > 3)) {
          return [];
        }

        return [{
          key: `upcoming-${period.user_id}-${period.started_at}-${period.ended_at}-${daysUntil}`,
          text: formatUnavailabilitySummary(period.full_name || period.user_id, toPeriodInfo(period), '')
        }];
      })
    }),
    [activeUnavailability, upcomingUnavailability]
  );

  const warningEntries = useMemo(
    () => [...warningGroups.active, ...warningGroups.upcoming],
    [warningGroups]
  );

  const warningKey = useMemo(
    () => warningEntries.map((entry) => entry.key).join('|'),
    [warningEntries]
  );

  const isWarningVisible = warningEntries.length > 0 && warningKey !== dismissedWarningKey;

  const visibleRequests = useMemo(() => {
    if (requestsTab === 'unassigned') {
      return unassignedRequests;
    }
    if (requestsTab === 'mine') {
      return myRequests;
    }
    return assignedRequests;
  }, [assignedRequests, myRequests, requestsTab, unassignedRequests]);

  const handleAssigneeChange = (requestId: number, ownerId: string) => {
    if (ownerId) {
      const active = getActiveUnavailability(ownerId, activeUnavailability);

      if (active) {
        const start = formatUnavailabilityDate(active.startedAt);
        const end = formatUnavailabilityDate(active.endedAt);
        setErrorMessage(`Нельзя назначить ответственного: сотрудник сейчас недоступен (${start} — ${end})`);
        return;
      }
    }

    setAssignmentState((prev) => ({ ...prev, [requestId]: ownerId }));
  };

  const toggleNode = (userId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [userId]: !(prev[userId] ?? false) }));
  };

  const applyAssignments = async (requestIds: number[]) => {
    const prepared = requestIds
      .map((requestId) => ({ requestId, ownerUserId: assignmentState[requestId] }))
      .filter((item): item is { requestId: number; ownerUserId: string } => Boolean(item.ownerUserId));

    if (prepared.length === 0) {
      setErrorMessage('Выберите ответственного хотя бы для одной заявки');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsAssigning(true);

    try {
      await Promise.all(
        prepared.map((item) =>
          updateRequestDetails({
            requestId: item.requestId,
            owner_user_id: item.ownerUserId
          })
        )
      );
      setSuccessMessage(
        prepared.length === 1
          ? `Заявка #${prepared[0].requestId} назначена сотруднику`
          : `Распределено заявок: ${prepared.length}`
      );
      await loadDashboard();
      setAssignmentState((prev) => {
        const next = { ...prev };
        for (const item of prepared) {
          delete next[item.requestId];
        }
        return next;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось назначить ответственных');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssignSingle = async (requestId: number) => {
    await applyAssignments([requestId]);
  };

  const handleAssignAllChanged = async () => {
    await applyAssignments(pendingAssignmentIds);
  };

  useEffect(() => {
    if (!warningKey || dismissedWarningKey === null) {
      return;
    }

    if (warningKey !== dismissedWarningKey) {
      setDismissedWarningKey(null);
    }
  }, [dismissedWarningKey, warningKey]);

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`Сотрудников: ${allSubordinates.length}`} color="primary" variant="outlined" size="small" />
        <Chip label={`Заявок в работе: ${inProgressTotal}`} color="info" variant="outlined" size="small" />
        <Chip label={`Нераспределённых: ${unassignedRequests.length}`} color="warning" variant="outlined" size="small" />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' },
          gap: 2
        }}
      >
        <CircularProcessChart totals={globalTotals} statusColors={statusColors} />
        <EmployeeWorkloadChart employees={allSubordinates} workloadColors={workloadColors} />
      </Box>

      {errorMessage ? (
        <Alert severity="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      ) : null}
      {isWarningVisible ? (
        <Alert severity="warning" onClose={() => setDismissedWarningKey(warningKey)}>
          <Stack spacing={0.5}>
            <Typography variant="body2" fontWeight={600}>
              Внимание: кто-то из сотрудников сейчас недоступен или скоро будет недоступен.
            </Typography>
            {warningGroups.active.length > 0 ? (
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Сейчас недоступны:
                </Typography>
                {warningGroups.active.map((entry) => (
                  <Typography key={entry.key} variant="body2">
                    {entry.text}
                  </Typography>
                ))}
              </Box>
            ) : null}
            {warningGroups.upcoming.length > 0 ? (
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Будут недоступны:
                </Typography>
                {warningGroups.upcoming.map((entry) => (
                  <Typography key={entry.key} variant="body2">
                    {entry.text}
                  </Typography>
                ))}
              </Box>
            ) : null}
          </Stack>
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' },
          gap: 2
        }}
      >
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              Занятость штата
            </Typography>
            {isLoading ? (
              <Typography color="text.secondary">Загрузка...</Typography>
            ) : tree.length === 0 ? (
              <Typography color="text.secondary">Подчинённые сотрудники не найдены</Typography>
            ) : (
              <Stack spacing={1.2}>
                {tree.map((node) => (
                  <EmployeeNodeCard
                    key={node.user_id}
                    node={node}
                    level={0}
                    expanded={expandedNodes}
                    onToggle={toggleNode}
                    statusColors={statusColors}
                    activeUnavailabilityByUser={activeUnavailabilityByUser}
                    upcomingUnavailabilityByUser={upcomingUnavailabilityByUser}
                  />
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 0, fontWeight: 700 }}>
              Заявки
            </Typography>
            {isLeadEconomist ? (
              <Tabs
                value={requestsTab}
                onChange={(_, value: 'unassigned' | 'mine' | 'assigned') => setRequestsTab(value)}
                sx={{ mb: 2 }}
              >
                <Tab value="unassigned" label={`Нераспределённые (${unassignedRequests.length})`} />
                <Tab value="mine" label={`Мои (${myRequests.length})`} />
                <Tab value="assigned" label={`Распределённые (${assignedRequests.length})`} />
              </Tabs>
            ) : (
              <Tabs
                value={requestsTab}
                onChange={(_, value: 'unassigned' | 'mine' | 'assigned') => setRequestsTab(value)}
                sx={{ mb: 2 }}
              >
                <Tab value="unassigned" label={`Нераспределённые (${unassignedRequests.length})`} />
                <Tab value="assigned" label={`Распределённые (${assignedRequests.length})`} />
              </Tabs>
            )}
            <Stack spacing={1.5}>
              {visibleRequests.length === 0 ? (
                requestsTab === 'mine' ? (
                  <Typography color="text.secondary">
                    Нет моих заявок в работе
                  </Typography>
                ) : (
                  <Typography color="text.secondary">
                    {requestsTab === 'unassigned'
                      ? 'Все заявки уже распределены по ответственным'
                      : 'Нет распределённых заявок в работе'}
                  </Typography>
                )
              ) : (
                visibleRequests.map((request) => {
                  const selectedOwner = assignmentState[request.request_id] ?? (requestsTab === 'unassigned' ? '' : request.owner_user_id);
                  const requestOwnerActiveUnavailability = activeUnavailabilityByUser[request.owner_user_id] ?? null;
                  const requestOwnerUpcomingUnavailability = upcomingUnavailabilityByUser[request.owner_user_id] ?? null;
                  const requestOwnerWarningTooltip = getRequestOwnerWarningTooltip({
                    activePeriod: requestOwnerActiveUnavailability,
                    upcomingPeriod: requestOwnerUpcomingUnavailability,
                  });
                  return (
                    <Card key={`${requestsTab}-${request.request_id}`} variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1.5}
                          justifyContent="space-between"
                          alignItems={{ xs: 'stretch', md: 'flex-start' }}
                        >
                          <Stack spacing={0.9} sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography fontWeight={700}>Заявка #{request.request_id}</Typography>
                              <Chip
                                size="small"
                                label={STATUS_LABELS[request.status] ?? request.status_label}
                                color={request.status === 'open' ? 'primary' : 'info'}
                              />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {request.description || 'Описание не указано'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Дедлайн: {formatDate(request.deadline_at)}
                            </Typography>
                            {requestsTab !== 'unassigned' ? (
                              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                                <Typography variant="caption" color="text.secondary">
                                  Ответственный: {request.owner_full_name || employeeNameById[request.owner_user_id] || request.owner_user_id}
                                </Typography>
                                {requestOwnerWarningTooltip ? (
                                  <Tooltip title={requestOwnerWarningTooltip} arrow>
                                    <Box
                                      component="span"
                                      sx={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: '50%',
                                        backgroundColor: requestOwnerActiveUnavailability ? '#fef2f2' : '#fff7ed',
                                        border: `1px solid ${requestOwnerActiveUnavailability ? '#ef4444' : '#f59e0b'}`,
                                        color: requestOwnerActiveUnavailability ? '#dc2626' : '#d97706',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 12,
                                        fontWeight: 800,
                                        lineHeight: 1,
                                        cursor: 'help'
                                      }}
                                    >
                                      !
                                    </Box>
                                  </Tooltip>
                                ) : null}
                              </Stack>
                            ) : null}
                          </Stack>

                          <Stack
                            spacing={1}
                            sx={{ width: { xs: '100%', md: 300 }, minHeight: { md: 92 }, justifyContent: 'space-between' }}
                          >
                            <Select
                              size="small"
                              displayEmpty
                              fullWidth
                              value={selectedOwner}
                              renderValue={(value) => resolveAssigneeLabel(request, String(value ?? ''))}
                              onChange={(event) => handleAssigneeChange(request.request_id, String(event.target.value))}
                            >
                              <MenuItem value="">Выберите ответственного</MenuItem>
                              {allSubordinates.map((employee) => (
                                <UnavailableAwareMenuItem
                                  key={`${request.request_id}-${employee.user_id}`}
                                  value={employee.user_id}
                                  label={`${employee.full_name || employee.user_id} (${employee.role_name})`}
                                  unavailablePeriod={getActiveUnavailability(employee.user_id, activeUnavailability)}
                                />
                              ))}
                            </Select>

                            <Stack direction="row" justifyContent="flex-end" sx={{ pt: { xs: 0, md: 0.5 } }}>
                              <Button
                                variant="outlined"
                                size="small"
                                sx={{
                                  minWidth: 48,
                                  height: 32,
                                  px: 1.5,
                                  fontWeight: 700,
                                  borderRadius: 999,
                                  borderColor: 'divider',
                                  color: 'text.secondary',
                                  backgroundColor: 'background.paper'
                                }}
                                onClick={() => void handleAssignSingle(request.request_id)}
                                disabled={!assignmentState[request.request_id] || isAssigning}
                              >
                                ОК
                              </Button>
                            </Stack>
                          </Stack>
                        </Stack>
                        </CardContent>
                    </Card>
                  );
                })
              )}
            </Stack>
            {visibleRequests.length > 0 ? (
              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => void handleAssignAllChanged()}
                disabled={pendingAssignmentIds.length === 0 || isAssigning}
              >
                {requestsTab === 'unassigned' ? 'Распределить заявки' : 'Сохранить изменения'}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
};
