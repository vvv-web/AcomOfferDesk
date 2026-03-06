import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Select,
  Stack,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getResponsibilityDashboard,
  type ResponsibilityEmployeeNode,
  type ResponsibilityStatusCounter,
  type ResponsibilityUnassignedRequest
} from '@shared/api/getResponsibilityDashboard';
import { updateRequestDetails } from '@shared/api/updateRequestDetails';

const ROLE_LEAD_ECONOMIST = 5;

const STATUS_LABELS: Record<string, string> = {
  open: 'Сбор КП',
  review: 'Анализ КП'
};

const STATUS_COLORS: Record<string, string> = {
  open: '#2f6fd6',
  review: '#6f8fcb'
};

type AssignmentState = Record<number, string>;
type ExpandedState = Record<string, boolean>;
type StatusTotals = Record<string, number>;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));

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
  height = 24,
  showNumbers = true
}: {
  totals: StatusTotals;
  height?: number;
  showNumbers?: boolean;
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
    <Box sx={{ display: 'flex', borderRadius: 999, overflow: 'hidden', height, backgroundColor: 'rgba(47,111,214,0.14)' }}>
      {normalizedEntries.map(([status, count]) => {
        const widthPercent = (count / total) * 100;
        return (
          <Box
            key={`${status}-${count}`}
            sx={{
              width: `${widthPercent}%`,
              minWidth: 26,
              backgroundColor: STATUS_COLORS[status] ?? '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {showNumbers ? (
              <Typography variant="caption" fontWeight={700} sx={{ color: '#fff' }}>
                {count}
              </Typography>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
};

const StatusLegend = ({ totals }: { totals: StatusTotals }) => {
  const entries = Object.entries(totals).filter(([, count]) => count > 0);
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {entries.map(([status, count]) => (
        <Chip
          key={`legend-${status}`}
          size="small"
          label={`${STATUS_LABELS[status] ?? status}: ${count}`}
          sx={{
            backgroundColor: `${STATUS_COLORS[status] ?? '#64748b'}22`,
            color: 'text.primary'
          }}
        />
      ))}
    </Stack>
  );
};



const CircularProcessChart = ({ totals }: { totals: StatusTotals }) => {
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
    const color = STATUS_COLORS[status] ?? '#64748b';
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
                            backgroundColor: STATUS_COLORS[status] ?? '#64748b'
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

const EmployeeNodeCard = ({
  node,
  level,
  expanded,
  onToggle
}: {
  node: ResponsibilityEmployeeNode;
  level: number;
  expanded: ExpandedState;
  onToggle: (userId: string) => void;
}) => {
  const ownTotals = getNodeTotals(node.statuses);
  const subordinatesTotals = collectDescendantTotals(node);
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded[node.user_id] ?? false;
  const isLead = node.role_id === ROLE_LEAD_ECONOMIST;

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
                <Chip size="small" label={node.role_name} />
                <Typography variant="caption" color="text.secondary">
                  В работе: {sumTotals(ownTotals)}
                </Typography>
                {isLead ? (
                  <Typography variant="caption" color="text.secondary">
                    Подчинённые: {sumTotals(subordinatesTotals)}
                  </Typography>
                ) : null}
              </Stack>
            </Stack>
            {hasChildren ? (
              <Button size="small" variant="outlined" onClick={() => onToggle(node.user_id)}>
                {isExpanded ? 'Свернуть' : 'Развернуть'}
              </Button>
            ) : null}
          </Stack>

          <Stack spacing={0.75}>
            <Typography variant="body2" fontWeight={600}>
              Личная загрузка
            </Typography>
            <SegmentedProgressBar totals={ownTotals} />
            <StatusLegend totals={ownTotals} />
          </Stack>

          {isLead ? (
            <Stack spacing={0.75}>
              <Typography variant="body2" fontWeight={600}>
                Загрузка подчинённых (суммарно)
              </Typography>
              <SegmentedProgressBar totals={subordinatesTotals} />
              <StatusLegend totals={subordinatesTotals} />
            </Stack>
          ) : null}
        </Stack>
      </CardContent>

      {hasChildren && isExpanded ? (
        <Stack spacing={1.2} sx={{ pb: 2, pr: 2, pl: 2 }}>
          {node.children.map((child) => (
            <EmployeeNodeCard key={child.user_id} node={child} level={level + 1} expanded={expanded} onToggle={onToggle} />
          ))}
        </Stack>
      ) : null}
    </Card>
  );
};

export const ProjectManagerDashboard = () => {
  const [tree, setTree] = useState<ResponsibilityEmployeeNode[]>([]);
  const [unassignedRequests, setUnassignedRequests] = useState<ResponsibilityUnassignedRequest[]>([]);
  const [assignmentState, setAssignmentState] = useState<AssignmentState>({});
  const [expandedNodes, setExpandedNodes] = useState<ExpandedState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getResponsibilityDashboard();
      setTree(response.tree);
      setUnassignedRequests(response.unassignedRequests);
      setExpandedNodes((prev) => {
        const next = { ...prev };
        for (const node of response.tree) {
          if (node.role_id === ROLE_LEAD_ECONOMIST && next[node.user_id] === undefined) {
            next[node.user_id] = true;
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

  const allSubordinates = useMemo(() => flattenEmployees(tree), [tree]);
  const globalTotals = useMemo(() => collectGlobalTotals(tree), [tree]);
  const inProgressTotal = useMemo(() => sumTotals(globalTotals), [globalTotals]);

  const handleAssigneeChange = (requestId: number, ownerId: string) => {
    setAssignmentState((prev) => ({ ...prev, [requestId]: ownerId }));
  };

  const toggleNode = (userId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [userId]: !(prev[userId] ?? false) }));
  };

  const handleAssign = async (requestId: number) => {
    const ownerUserId = assignmentState[requestId];
    if (!ownerUserId) {
      setErrorMessage('Выберите ответственного сотрудника перед назначением');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateRequestDetails({
        requestId,
        owner_user_id: ownerUserId
      });
      setSuccessMessage(`Заявка #${requestId} назначена сотруднику`);
      await loadDashboard();
      setAssignmentState((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось назначить ответственного');
    }
  };

  return (
    <Stack spacing={2.5}>
      <Card
        sx={{
          borderRadius: 2,
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(14,165,233,0.08))'
        }}
      >
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Дашборд Руководителя проекта
              </Typography>
              <Typography color="text.secondary">
                Иерархия подчинённых экономистов и текущая загрузка по заявкам в работе.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip label={`Сотрудников: ${allSubordinates.length}`} color="primary" variant="outlined" />
              <Chip label={`Заявок в работе: ${inProgressTotal}`} color="info" variant="outlined" />
              <Chip label={`Нераспределённых: ${unassignedRequests.length}`} color="warning" variant="outlined" />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <CircularProcessChart totals={globalTotals} />

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

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
              Иерархия экономистов
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
                  />
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              Нераспределённые заявки
            </Typography>
            <Stack spacing={1.5}>
              {unassignedRequests.length === 0 ? (
                <Typography color="text.secondary">Все заявки уже распределены по ответственным</Typography>
              ) : (
                unassignedRequests.map((request) => (
                  <Card key={request.request_id} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Stack spacing={1.25}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
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
                        <Select
                          size="small"
                          displayEmpty
                          value={assignmentState[request.request_id] ?? ''}
                          onChange={(event) => handleAssigneeChange(request.request_id, String(event.target.value))}
                        >
                          <MenuItem value="">Выберите ответственного</MenuItem>
                          {allSubordinates.map((employee) => (
                            <MenuItem key={`${request.request_id}-${employee.user_id}`} value={employee.user_id}>
                              {employee.full_name || employee.user_id} ({employee.role_name})
                            </MenuItem>
                          ))}
                        </Select>
                        <Button
                          variant="contained"
                          onClick={() => void handleAssign(request.request_id)}
                          disabled={!assignmentState[request.request_id]}
                        >
                          Назначить ответственного
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
};
