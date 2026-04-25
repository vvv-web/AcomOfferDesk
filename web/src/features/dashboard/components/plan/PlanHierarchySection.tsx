import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlanTreeNode } from '@shared/api/plans';
import { formatAmount } from '@shared/lib/formatters';
import { planSectionCardSx } from './PlanOverviewSections';
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
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(7, minmax(0, 1fr))' },
        gap: 0.6,
      }}
    >
      {metricItems.map((metric) => (
        <Box
          key={metric.label}
          sx={{
            borderRadius: 1.5,
            px: 0.35,
            py: 0.3,
            bgcolor: 'transparent',
            border: 'none',
            minWidth: 0,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, lineHeight: 1.15 }}>
            {metric.label}
          </Typography>
          <Typography variant="caption" fontWeight={700} sx={{ display: 'block', fontSize: 12.5, lineHeight: 1.2, mt: 0.2 }}>
            {metric.value}
          </Typography>
        </Box>
      ))}
    </Box>
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
    borderRadius: '8px',
    border: '1px solid #dbe2ea',
    color: '#7c8da1',
    bgcolor: '#ffffff',
    '&:hover': {
      bgcolor: '#f8fafc',
      borderColor: '#e2e8f0',
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
          title: 'Закрыть план',
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
    <Box
      sx={{
        position: 'relative',
        pl: depth === 0 ? 0 : { xs: 2.4, md: 3.2 },
        backgroundColor: 'transparent',
      }}
    >
      {depth > 0 ? (
        <>
          <Box
            sx={{
              position: 'absolute',
              top: -16,
              bottom: 0,
              left: { xs: 8, md: 15 },
              width: 1,
              bgcolor: '#ffffff',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 28,
              left: { xs: 8, md: 15 },
              width: { xs: 12, md: 18 },
              height: 1,
              bgcolor: '#ffffff',
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
              mt: 1.1,
              width: 28,
              height: 28,
              border: '1px solid #dbe2ea',
              bgcolor: '#ffffff',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <ChevronRightRoundedIcon sx={{ fontSize: 18, color: '#7c8da1' }} />
          </IconButton>
        ) : (
          <Box sx={{ width: 28, flexShrink: 0 }} />
        )}

        <Card
          sx={{
            ...planSectionCardSx,
            width: '100%',
            position: 'relative',
            zIndex: 1,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: 'none',
          }}
        >
          <CardContent sx={{ p: { xs: 0.95, md: 1.1 }, '&:last-child': { pb: { xs: 0.95, md: 1.1 } } }}>
            <Stack spacing={0.75} sx={{ position: 'relative', zIndex: 3 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} justifyContent="space-between">
                <Stack direction="row" spacing={0.85} minWidth={0}>
                  {isSyntheticRoot ? (
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '12px',
                        bgcolor: '#dbeafe',
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
                        width: 36,
                        height: 36,
                        bgcolor: '#dbeafe',
                        color: 'primary.main',
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      {getInitials(node.user_name)}
                    </Avatar>
                  )}

                  <Stack spacing={0.45} minWidth={0} flex={1}>
                    <Stack direction="row" spacing={0.65} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="body2" fontWeight={800} sx={{ overflowWrap: 'anywhere', lineHeight: 1.2, fontSize: 15 }}>
                        {isSyntheticRoot ? node.plan_name : node.user_name}
                      </Typography>
                      {isSyntheticRoot ? (
                        <Chip
                          size="small"
                          label="Корневой узел"
                          sx={{
                            bgcolor: '#dbeafe',
                            color: 'primary.main',
                            height: 20,
                            '& .MuiChip-label': { px: 0.9, fontWeight: 600, fontSize: 11.5 },
                          }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label={node.user_role}
                          sx={{
                            bgcolor: '#ffffff',
                            color: 'text.secondary',
                            border: '1px solid #e5e7eb',
                            height: 20,
                            '& .MuiChip-label': { px: 0.85, fontSize: 11.5 },
                          }}
                        />
                      )}
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere', lineHeight: 1.15, fontSize: 11.5 }}>
                      {isSyntheticRoot ? 'Общий узел периода и распределения' : node.plan_name}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={0.9} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" sx={{ minWidth: { md: 320 } }}>
                  <Stack spacing={0.2} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                    <Typography variant="body2" fontWeight={800} sx={{ textAlign: { xs: 'left', md: 'right' }, fontSize: 14 }}>
                      {formatAmount(node.fact_amount_subtree)} / {formatAmount(node.plan_amount)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: { xs: 'left', md: 'right' }, fontSize: 11.5 }}>
                      Выполнение: {formatPercent(node.progress_percent)}
                    </Typography>
                  </Stack>
                  {actions.length > 0 ? (
                    <Stack direction="row" spacing={0.45} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} flexWrap="nowrap">
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
                  ) : null}
                </Stack>
              </Stack>

              <Box
                sx={{
                  borderRadius: 2,
                  px: 0.2,
                  py: 0.15,
                  bgcolor: 'transparent',
                  border: 'none',
                }}
              >
                <Stack spacing={0.55}>
                  <LinearProgress
                    variant="determinate"
                    value={progressValue}
                    sx={{
                      height: 6,
                      borderRadius: 999,
                      bgcolor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        backgroundColor: progressValue >= 100 ? theme.palette.success.main : theme.palette.primary.main,
                      },
                    }}
                  />
                  <Stack direction="row" justifyContent="space-between" spacing={0.8} flexWrap="wrap" useFlexGap>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                      Период: {node.period_start} - {node.period_end}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                      Остаток: {formatAmount(node.remaining_amount)}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>

              <PlanNodeMetricChips node={node} />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {hasChildren && isExpanded ? (
        <Stack spacing={0.85} sx={{ pt: 0.85, backgroundColor: 'transparent', position: 'relative', zIndex: 0 }}>
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
    <Stack spacing={1.1}>
      <Card sx={planSectionCardSx}>
        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Stack spacing={1.1}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
              <Stack direction="row" spacing={0.9} alignItems="center">
                <PeopleAltOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={800}>
                  Подчиненные без плана
                </Typography>
              </Stack>
              {unplannedSubordinates.length > 0 ? (
                <Chip size="small" label={String(unplannedSubordinates.length)} sx={{ bgcolor: '#dbeafe' }} />
              ) : null}
            </Stack>

            {unplannedSubordinates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Нет подчиненных без плана.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {unplannedSubordinates.slice(0, 3).map((employee) => (
                  <Stack key={employee.id} direction="row" spacing={0.9} alignItems="center">
                    <Avatar sx={{ width: 34, height: 34, bgcolor: '#fde68a', color: '#b45309', fontSize: 13, fontWeight: 800 }}>
                      {getInitials(employee.name)}
                    </Avatar>
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                        {employee.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {employee.role}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
                <Button variant="outlined" fullWidth startIcon={<PersonAddAlt1RoundedIcon />}>
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
            <Stack direction="row" spacing={0.9} alignItems="center">
              <TrendingUpRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={800}>
                Загрузка (личная)
              </Typography>
            </Stack>

            <Stack spacing={1.15}>
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  Ваша личная загрузка
                </Typography>
                <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mt: 0.45, mb: 0.55 }}>
                  <Typography variant="caption" color="text.secondary">
                    {data.personalFactAmount !== null && data.personalFactAmount !== undefined
                      ? `${formatAmount(data.personalFactAmount)} / ${formatAmount(data.personalPlanAmount ?? 0)}`
                      : '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data.personalProgressPercent !== null && data.personalProgressPercent !== undefined
                      ? formatPercent(data.personalProgressPercent)
                      : '—'}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(100, data.personalProgressPercent ?? 0))}
                  sx={{
                    height: 7,
                    borderRadius: 999,
                    bgcolor: '#dbeafe',
                  }}
                />
              </Box>

              <Divider />

              <Box>
                <Typography variant="body2" fontWeight={700}>
                  Средняя загрузка подчиненных
                </Typography>
                <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mt: 0.45, mb: 0.55 }}>
                  <Typography variant="caption" color="text.secondary">
                    {data.averageSubordinatesFactAmount !== null && data.averageSubordinatesFactAmount !== undefined
                      ? `${formatAmount(data.averageSubordinatesFactAmount)} / ${formatAmount(data.averageSubordinatesPlanAmount ?? 0)}`
                      : '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data.averageSubordinatesProgressPercent !== null && data.averageSubordinatesProgressPercent !== undefined
                      ? formatPercent(data.averageSubordinatesProgressPercent)
                      : '—'}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(100, data.averageSubordinatesProgressPercent ?? 0))}
                  color="success"
                  sx={{
                    height: 7,
                    borderRadius: 999,
                    bgcolor: '#bbf7d0',
                  }}
                />
              </Box>
            </Stack>

            <Button variant="text" endIcon={<ChevronRightRoundedIcon />} onClick={() => navigate('/pm-dashboard')} sx={{ justifyContent: 'flex-start', px: 0 }}>
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
    <Card sx={{ ...planSectionCardSx, overflow: 'visible', boxShadow: 'none', border: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
      <CardContent sx={{ p: { xs: 1.1, md: 1.25 }, '&:last-child': { pb: { xs: 1.1, md: 1.25 } } }}>
        <Stack spacing={1.1}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            justifyContent="space-between"
            spacing={1}
            alignItems={{ xs: 'stretch', lg: 'center' }}
          >
            <Typography variant="subtitle1" fontWeight={800}>
              Иерархия плана
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.9} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={onExpandAll}
                startIcon={<ManageSearchRoundedIcon />}
                sx={{
                  minHeight: 36,
                  whiteSpace: 'nowrap',
                  borderColor: '#e2e8f0',
                  color: '#4b74b8',
                  '&:hover': { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
                }}
              >
                Развернуть все
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={onCollapseAll}
                sx={{ minHeight: 36, whiteSpace: 'nowrap', color: '#64748b', '&:hover': { backgroundColor: '#f8fafc' } }}
              >
                Свернуть все
              </Button>
              <TextField
                size="small"
                placeholder="Поиск по узлам"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                sx={{
                  minWidth: { xs: '100%', md: 240 },
                  '& .MuiOutlinedInput-root': { minHeight: 36, backgroundColor: '#ffffff' },
                }}
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
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 308px' },
              gap: 1.25,
              alignItems: 'start',
            }}
          >
            <Stack spacing={0.95}>
              {!hasItems ? (
                <Card variant="outlined" sx={{ borderRadius: 3, borderColor: '#e2e8f0' }}>
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

            <Box sx={{ position: { xs: 'static', xl: 'sticky' }, top: { xl: 16 }, zIndex: 2 }}>
              <PlanSideSummary data={sideSummary} />
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};
