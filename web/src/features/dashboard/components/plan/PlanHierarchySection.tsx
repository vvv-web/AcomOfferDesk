import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlanTreeNode } from '@shared/api/plans';
import { formatAmount } from '@shared/lib/formatters';
import { hierarchyTitleIcon, planSectionCardSx } from './PlanOverviewSections';
import type { PlanSideSummaryData } from './planDashboardUtils';
import { formatPercent, getInitials } from './planDashboardUtils';

export type PlanHierarchyHandlers = {
  onCreateSubplan: (node: PlanTreeNode) => void;
  onDelegate: (node: PlanTreeNode) => void;
  onEdit: (node: PlanTreeNode) => void;
  onDelete: (node: PlanTreeNode) => void;
  onClosePlan: (node: PlanTreeNode) => void;
};

type PlanNodeMetricGridProps = {
  node: PlanTreeNode;
};

export const PlanNodeMetricChips = ({ node }: PlanNodeMetricGridProps) => {
  const metricItems = [
    { label: 'План узла', value: formatAmount(node.plan_amount) },
    { label: 'Личный план', value: formatAmount(node.personal_plan_amount) },
    { label: 'Распределено', value: formatAmount(node.delegated_amount) },
    { label: 'Факт ветки', value: formatAmount(node.fact_amount_subtree) },
    { label: 'Факт личный', value: formatAmount(node.fact_amount_self) },
    { label: 'Остаток', value: formatAmount(node.remaining_amount) },
    { label: 'Выполнение', value: formatPercent(node.progress_percent) },
  ];

  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {metricItems.map((metric) => (
        <Stack
          key={metric.label}
          direction="row"
          spacing={0.35}
          alignItems="baseline"
          sx={{ minWidth: 0 }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.05, whiteSpace: 'nowrap' }}>
            {metric.label}
          </Typography>
          <Typography variant="caption" fontWeight={700} sx={{ overflowWrap: 'anywhere', lineHeight: 1.05 }}>
            {metric.value}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};

type PlanTreeNodeCardProps = {
  node: PlanTreeNode;
  depth: number;
  expandedNodeIds: Record<number, boolean>;
  forceExpanded: boolean;
  onToggle: (planId: number) => void;
  handlers: PlanHierarchyHandlers;
};

export const PlanTreeNodeCard = ({
  node,
  depth,
  expandedNodeIds,
  forceExpanded,
  onToggle,
  handlers,
}: PlanTreeNodeCardProps) => {
  const theme = useTheme();
  const isCompactActions = useMediaQuery(theme.breakpoints.down('md'));
  const [actionsAnchorEl, setActionsAnchorEl] = useState<null | HTMLElement>(null);
  const hasChildren = node.children.length > 0;
  const isExpanded = forceExpanded || expandedNodeIds[node.plan_id] !== false;
  const progressValue = Math.max(0, Math.min(100, node.progress_percent));
  const isRoot = depth === 0;
  const isSyntheticRoot = isRoot && node.children.some((child) => child.user_id === node.user_id);
  const iconButtonSx = {
    width: 28,
    height: 28,
    borderRadius: '9px',
    border: '1px solid rgba(59, 130, 246, 0.24)',
    color: 'primary.main',
    bgcolor: 'background.paper',
    '&:hover': {
      bgcolor: alpha(theme.palette.primary.main, 0.1),
      borderColor: alpha(theme.palette.primary.main, 0.34),
    },
  } as const;

  const actions = [
    node.available_actions.create_subplan
      ? {
          key: 'create-subplan',
          title: 'Создать подплан',
          icon: <AccountTreeOutlinedIcon sx={{ fontSize: 18 }} />,
          onClick: () => handlers.onCreateSubplan(node),
        }
      : null,
    node.available_actions.delegate_plan
      ? {
          key: 'delegate',
          title: 'Делегировать',
          icon: <FileUploadOutlinedIcon sx={{ fontSize: 18 }} />,
          onClick: () => handlers.onDelegate(node),
        }
      : null,
    node.available_actions.edit_plan
      ? {
          key: 'edit',
          title: 'Редактировать',
          icon: <EditOutlinedIcon sx={{ fontSize: 18 }} />,
          onClick: () => handlers.onEdit(node),
        }
      : null,
    node.available_actions.close_plan
      ? {
          key: 'close',
          title: 'Заблокировать',
          icon: <LockOutlinedIcon sx={{ fontSize: 18 }} />,
          onClick: () => handlers.onClosePlan(node),
        }
      : null,
    node.available_actions.delete_child_plan
      ? {
          key: 'delete',
          title: 'Удалить',
          icon: <DeleteOutlineOutlinedIcon sx={{ fontSize: 18 }} />,
          onClick: () => handlers.onDelete(node),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const visibleInlineActions = isCompactActions && actions.length > 2 ? actions.slice(0, 1) : actions;
  const hiddenActions = isCompactActions && actions.length > 2 ? actions.slice(1) : [];

  return (
    <Box sx={{ position: 'relative', pl: depth === 0 ? 0 : 4 }}>
      {depth > 0 ? (
        <>
          <Box
            sx={{
              position: 'absolute',
              top: -14,
              bottom: 0,
              left: 15,
              width: 2,
              bgcolor: 'rgba(148, 163, 184, 0.16)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 32,
              left: 15,
              width: 18,
              height: 2,
              bgcolor: 'rgba(148, 163, 184, 0.16)',
            }}
          />
        </>
      ) : null}

      <Stack direction="row" spacing={1} alignItems="flex-start">
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={() => onToggle(node.plan_id)}
            sx={{
              mt: 1,
              width: 24,
              height: 24,
              border: '1px solid rgba(148, 163, 184, 0.24)',
              bgcolor: 'background.paper',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        ) : (
          <Box sx={{ width: 28, flexShrink: 0 }} />
        )}

        <Card sx={{ ...planSectionCardSx, width: '100%' }}>
          <CardContent sx={{ p: { xs: 1, md: 1.1 }, '&:last-child': { pb: { xs: 1, md: 1.1 } } }}>
            <Stack spacing={0.7}>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.7} justifyContent="space-between">
                <Stack direction="row" spacing={1} minWidth={0}>
                  {isSyntheticRoot ? (
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '12px',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ManageSearchRoundedIcon sx={{ fontSize: 18 }} />
                    </Box>
                  ) : (
                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                        color: 'primary.main',
                        fontWeight: 800,
                        fontSize: 14,
                      }}
                    >
                      {getInitials(node.user_name)}
                    </Avatar>
                  )}

                  <Stack spacing={0.35} minWidth={0} flex={1}>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Typography variant="caption" fontWeight={800} sx={{ overflowWrap: 'anywhere', lineHeight: 1.2, fontSize: 13 }}>
                        {isSyntheticRoot ? node.plan_name : node.user_name}
                      </Typography>
                      {!isSyntheticRoot ? (
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {node.user_role}
                        </Typography>
                      ) : (
                        <Chip
                          size="small"
                          label="Корневой узел"
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            color: 'primary.main',
                            height: 20,
                          }}
                        />
                      )}
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere', lineHeight: 1.05 }}>
                      {isSyntheticRoot ? 'Общий узел периода и распределения' : node.plan_name}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack spacing={0.5} alignItems={{ xs: 'stretch', lg: 'flex-end' }}>
                  <Typography variant="caption" fontWeight={800} sx={{ textAlign: { xs: 'left', lg: 'right' }, fontSize: 11 }}>
                    {formatAmount(node.fact_amount_subtree)} / {formatAmount(node.plan_amount)} | {formatPercent(node.progress_percent)}
                  </Typography>
                  {actions.length > 0 ? (
                    <Stack direction="row" spacing={0.5} justifyContent={{ xs: 'flex-start', lg: 'flex-end' }} flexWrap="wrap" useFlexGap>
                      {visibleInlineActions.map((action) => (
                        <Tooltip key={action.key} title={action.title}>
                          <IconButton size="small" onClick={action.onClick} sx={iconButtonSx}>
                            {action.icon}
                          </IconButton>
                        </Tooltip>
                      ))}
                      {hiddenActions.length > 0 ? (
                        <>
                          <IconButton size="small" onClick={(event) => setActionsAnchorEl(event.currentTarget)} sx={iconButtonSx}>
                            <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                          <Menu
                            anchorEl={actionsAnchorEl}
                            open={Boolean(actionsAnchorEl)}
                            onClose={() => setActionsAnchorEl(null)}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                          >
                            {hiddenActions.map((action) => (
                              <MenuItem
                                key={action.key}
                                onClick={() => {
                                  setActionsAnchorEl(null);
                                  action.onClick();
                                }}
                              >
                                {action.title}
                              </MenuItem>
                            ))}
                          </Menu>
                        </>
                      ) : null}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Нет доступных действий
                    </Typography>
                  )}
                </Stack>
              </Stack>

              <Stack spacing={0.45}>
                <LinearProgress
                  variant="determinate"
                  value={progressValue}
                  sx={{
                    height: 4,
                    borderRadius: 999,
                    bgcolor: alpha(theme.palette.primary.main, 0.09),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 999,
                      background: progressValue >= 100
                        ? theme.palette.success.main
                        : `linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.72)})`,
                    },
                  }}
                />
                <Stack direction="row" justifyContent="space-between" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography variant="caption" color="text.secondary">
                    Период: {node.period_start} - {node.period_end}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Остаток: {formatAmount(node.remaining_amount)}
                  </Typography>
                </Stack>
              </Stack>

              <PlanNodeMetricChips node={node} />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {hasChildren ? (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Stack spacing={0.75} sx={{ pt: 0.75 }}>
            {node.children.map((child) => (
              <PlanTreeNodeCard
                key={child.plan_id}
                node={child}
                depth={depth + 1}
                expandedNodeIds={expandedNodeIds}
                forceExpanded={forceExpanded}
                onToggle={onToggle}
                handlers={handlers}
              />
            ))}
          </Stack>
        </Collapse>
      ) : null}
    </Box>
  );
};

type PlanSideSummaryProps = {
  data: PlanSideSummaryData;
  unplannedSubordinates?: Array<{ id: string; name: string; role: string }>;
};

export const PlanSideSummary = ({ data, unplannedSubordinates = [] }: PlanSideSummaryProps) => {
  const navigate = useNavigate();

  return (
    <Stack spacing={1.25}>
      <Card sx={planSectionCardSx}>
        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Stack spacing={1.1}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <PeopleAltOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={800}>
                  Подчиненные без плана
                </Typography>
              </Stack>
              {unplannedSubordinates.length > 0 ? <Chip size="small" label={String(unplannedSubordinates.length)} /> : null}
            </Stack>

            {unplannedSubordinates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Нет подчиненных без плана.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {unplannedSubordinates.slice(0, 3).map((employee) => (
                  <Box key={employee.id}>
                    <Typography variant="body2" fontWeight={700}>
                      {employee.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {employee.role}
                    </Typography>
                  </Box>
                ))}
                <Button variant="outlined" fullWidth>
                  Назначить план
                </Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={planSectionCardSx}>
        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Stack spacing={1.1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TrendingUpRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={800}>
                Загрузка (личная)
              </Typography>
            </Stack>

            <Stack spacing={1.1}>
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  Ваша личная загрузка
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {data.personalFactAmount !== null && data.personalFactAmount !== undefined
                    ? `${formatAmount(data.personalFactAmount)} / ${formatAmount(data.personalPlanAmount ?? 0)}`
                    : '—'}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(100, data.personalProgressPercent ?? 0))}
                  sx={{ mt: 0.6, height: 6, borderRadius: 999 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {data.personalProgressPercent !== null && data.personalProgressPercent !== undefined
                    ? formatPercent(data.personalProgressPercent)
                    : '—'}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="body2" fontWeight={700}>
                  Средняя загрузка подчиненных
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {data.averageSubordinatesFactAmount !== null && data.averageSubordinatesFactAmount !== undefined
                    ? `${formatAmount(data.averageSubordinatesFactAmount)} / ${formatAmount(data.averageSubordinatesPlanAmount ?? 0)}`
                    : '—'}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(100, data.averageSubordinatesProgressPercent ?? 0))}
                  sx={{ mt: 0.6, height: 6, borderRadius: 999 }}
                  color="success"
                />
                <Typography variant="caption" color="text.secondary">
                  {data.averageSubordinatesProgressPercent !== null && data.averageSubordinatesProgressPercent !== undefined
                    ? formatPercent(data.averageSubordinatesProgressPercent)
                    : '—'}
                </Typography>
              </Box>
            </Stack>

            <Button variant="text" endIcon={<ChevronRightRoundedIcon />} onClick={() => navigate('/pm-dashboard')}>
              Перейти к сотрудникам
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

type PlanHierarchySectionProps = {
  trees: PlanTreeNode[];
  searchValue: string;
  expandedNodeIds: Record<number, boolean>;
  forceExpanded: boolean;
  handlers: PlanHierarchyHandlers;
  sideSummary: PlanSideSummaryData;
  onSearchChange: (value: string) => void;
  onToggleNode: (planId: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

export const PlanHierarchySection = ({
  trees,
  searchValue,
  expandedNodeIds,
  forceExpanded,
  handlers,
  sideSummary,
  onSearchChange,
  onToggleNode,
  onExpandAll,
  onCollapseAll,
}: PlanHierarchySectionProps) => {
  const hasItems = trees.length > 0;

  return (
    <Card sx={{ ...planSectionCardSx, overflow: 'visible' }}>
      <CardContent sx={{ p: { xs: 1, md: 1.1 }, '&:last-child': { pb: { xs: 1, md: 1.1 } } }}>
        <Stack spacing={1}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            justifyContent="space-between"
            spacing={1}
            alignItems={{ xs: 'stretch', lg: 'center' }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              {hierarchyTitleIcon}
              <Typography variant="subtitle1" fontWeight={800}>
                Иерархия плана
              </Typography>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Button variant="outlined" size="small" onClick={onExpandAll} startIcon={<ManageSearchRoundedIcon />} sx={{ minHeight: 30 }}>
                Развернуть все
              </Button>
              <Button variant="text" size="small" onClick={onCollapseAll} sx={{ minHeight: 30 }}>
                Свернуть все
              </Button>
              <TextField
                size="small"
                placeholder="Поиск по узлам"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                sx={{ minWidth: { xs: '100%', md: 220 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 300px' },
              gap: 1.25,
              alignItems: 'start',
            }}
          >
            <Stack spacing={1}>
              {!hasItems ? (
                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      По текущему фильтру не найдено ни одного узла плана.
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                trees.map((node) => (
                  <PlanTreeNodeCard
                    key={node.plan_id}
                    node={node}
                    depth={0}
                    expandedNodeIds={expandedNodeIds}
                    forceExpanded={forceExpanded}
                    onToggle={onToggleNode}
                    handlers={handlers}
                  />
                ))
              )}
            </Stack>

            <Box sx={{ position: { xs: 'static', xl: 'sticky' }, top: { xl: 16 } }}>
              <PlanSideSummary data={sideSummary} />
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};
