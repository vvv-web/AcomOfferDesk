import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { formatAmount } from '@shared/lib/formatters';
import type { PlanDelegateCandidate, PlanTreeNode } from '@shared/api/plans';
import { usePlanDashboard } from '../model/usePlanDashboard';

const amountStringSchema = z
  .string()
  .trim()
  .min(1, 'Укажите сумму')
  .refine((value) => {
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0;
  }, 'Введите корректную сумму');

const rootPlanSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название плана'),
  periodStart: z.string().trim().min(10, 'Укажите дату начала'),
  planAmount: amountStringSchema,
});

const subplanSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название подплана'),
  periodStart: z.string().trim().min(10, 'Укажите дату начала'),
  amount: amountStringSchema.refine((value) => Number(value.replace(',', '.')) > 0, 'Сумма должна быть больше нуля'),
});

const delegateSchema = z.object({
  childUserId: z.string().trim().min(1, 'Выберите подчиненного'),
  childPeriodStart: z.string().trim().min(10, 'Укажите дату начала'),
  childPlanAmount: amountStringSchema.refine((value) => Number(value.replace(',', '.')) > 0, 'Сумма должна быть больше нуля'),
});

const editSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название плана'),
  planAmount: amountStringSchema,
});

type RootPlanFormValues = z.infer<typeof rootPlanSchema>;
type SubplanFormValues = z.infer<typeof subplanSchema>;
type DelegateFormValues = z.infer<typeof delegateSchema>;
type EditFormValues = z.infer<typeof editSchema>;

const parseAmount = (value: string) => Number(value.replace(',', '.'));
const formatPercent = (value: number) => `${Number.isFinite(value) ? value.toFixed(2) : '0.00'}%`;
const periodToDate = (period: string) => `${period}-01`;

const SummaryCard = ({ title, value, color }: { title: string; value: string; color?: string }) => (
  <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h6" fontWeight={700} color={color ?? 'text.primary'}>
        {value}
      </Typography>
    </CardContent>
  </Card>
);

const PlanNodeCard = ({
  node,
  depth,
  onCreateSubplan,
  onDelegate,
  onEdit,
  onDelete,
  onClosePlan,
}: {
  node: PlanTreeNode;
  depth: number;
  onCreateSubplan: (node: PlanTreeNode) => void;
  onDelegate: (node: PlanTreeNode) => void;
  onEdit: (node: PlanTreeNode) => void;
  onDelete: (node: PlanTreeNode) => void;
  onClosePlan: (node: PlanTreeNode) => void;
}) => {
  const unallocatedColor = node.unallocated_amount < 0 ? 'error.main' : node.unallocated_amount > 0 ? 'warning.main' : 'success.main';

  return (
    <Stack spacing={1.25} sx={{ pl: depth === 0 ? 0 : 2, borderLeft: depth === 0 ? 'none' : '2px solid', borderColor: 'divider' }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Stack spacing={1}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
              <Stack spacing={0.4}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {node.plan_name}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  <Chip label={node.user_name} size="small" variant="outlined" />
                  <Chip label={node.user_role} size="small" variant="outlined" />
                </Stack>
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                {node.available_actions.create_subplan ? (
                  <Button size="small" variant="outlined" onClick={() => onCreateSubplan(node)}>
                    Подплан
                  </Button>
                ) : null}
                {node.available_actions.delegate_plan ? (
                  <Button size="small" variant="outlined" onClick={() => onDelegate(node)}>
                    Делегировать
                  </Button>
                ) : null}
                {node.available_actions.edit_plan ? (
                  <Button size="small" variant="outlined" onClick={() => onEdit(node)}>
                    Изменить
                  </Button>
                ) : null}
                {node.available_actions.close_plan ? (
                  <Button size="small" variant="outlined" color="warning" onClick={() => onClosePlan(node)}>
                    Закрыть
                  </Button>
                ) : null}
                {node.available_actions.delete_child_plan ? (
                  <Button size="small" variant="outlined" color="error" onClick={() => onDelete(node)}>
                    Удалить
                  </Button>
                ) : null}
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <SummaryCard title="План узла" value={formatAmount(node.plan_amount)} />
              <SummaryCard title="Распределено детям" value={formatAmount(node.delegated_amount)} />
              <SummaryCard title="Личный план" value={formatAmount(node.personal_plan_amount)} />
              <SummaryCard title="Факт (ветка)" value={formatAmount(node.fact_amount_subtree)} />
              <SummaryCard title="Выполнение" value={formatPercent(node.progress_percent)} />
              <SummaryCard title="Остаток" value={formatAmount(node.remaining_amount)} />
              <SummaryCard title="Нераспределено" value={formatAmount(node.unallocated_amount)} color={unallocatedColor} />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {node.children.map((child) => (
        <PlanNodeCard
          key={child.plan_id}
          node={child}
          depth={depth + 1}
          onCreateSubplan={onCreateSubplan}
          onDelegate={onDelegate}
          onEdit={onEdit}
          onDelete={onDelete}
          onClosePlan={onClosePlan}
        />
      ))}
    </Stack>
  );
};

export const ProjectManagerPlanDashboard = () => {
  const {
    period,
    setPeriod,
    summary,
    trees,
    isLoading,
    isMutating,
    canCreateRootPlan,
    errorMessage,
    successMessage,
    setSuccessMessage,
    createRoot,
    createSubplanNodeWithStart,
    delegate,
    updatePlanNode,
    removeChildPlan,
    closePlanNode,
    loadDelegateCandidates,
  } = usePlanDashboard();

  const [isRootDialogOpen, setIsRootDialogOpen] = useState(false);
  const [subplanNode, setSubplanNode] = useState<PlanTreeNode | null>(null);
  const [delegateNode, setDelegateNode] = useState<PlanTreeNode | null>(null);
  const [delegateCandidates, setDelegateCandidates] = useState<PlanDelegateCandidate[]>([]);
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(false);
  const [editNode, setEditNode] = useState<PlanTreeNode | null>(null);
  const [deleteNode, setDeleteNode] = useState<PlanTreeNode | null>(null);
  const [closeNode, setCloseNode] = useState<PlanTreeNode | null>(null);

  const rootPlanForm = useForm<RootPlanFormValues>({
    resolver: zodResolver(rootPlanSchema),
    defaultValues: { name: '', periodStart: periodToDate(period), planAmount: '' },
  });
  const subplanForm = useForm<SubplanFormValues>({
    resolver: zodResolver(subplanSchema),
    defaultValues: { name: '', periodStart: periodToDate(period), amount: '' },
  });
  const delegateForm = useForm<DelegateFormValues>({
    resolver: zodResolver(delegateSchema),
    defaultValues: { childUserId: '', childPeriodStart: periodToDate(period), childPlanAmount: '' },
  });
  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', planAmount: '' },
  });

  useEffect(() => {
    rootPlanForm.setValue('periodStart', periodToDate(period));
    if (!subplanNode) {
      subplanForm.setValue('periodStart', periodToDate(period));
    }
    if (!delegateNode) {
      delegateForm.setValue('childPeriodStart', periodToDate(period));
    }
  }, [delegateForm, delegateNode, period, rootPlanForm, subplanForm, subplanNode]);

  useEffect(() => {
    if (!delegateNode) {
      return;
    }
    let isMounted = true;
    setIsCandidatesLoading(true);
    loadDelegateCandidates(delegateNode.plan_id)
      .then((items) => {
        if (isMounted) {
          setDelegateCandidates(items);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDelegateCandidates([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsCandidatesLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [delegateNode, loadDelegateCandidates]);

  const openEditDialog = (node: PlanTreeNode) => {
    setEditNode(node);
    editForm.reset({
      name: node.plan_name,
      planAmount: node.plan_amount.toFixed(2),
    });
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        <Typography variant="h5" fontWeight={700}>
          План экономии
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField
            type="month"
            label="Период"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            size="small"
            sx={{ width: { xs: '100%', md: 220 } }}
          />
          {canCreateRootPlan ? (
            <Button variant="contained" onClick={() => setIsRootDialogOpen(true)} disabled={isMutating}>
              Добавить план
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert severity="success" onClose={() => setSuccessMessage(null)}>{successMessage}</Alert> : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <SummaryCard title="Общий план" value={formatAmount(summary?.total_plan_amount ?? 0)} />
        <SummaryCard title="Общий факт" value={formatAmount(summary?.total_fact_amount ?? 0)} />
        <SummaryCard title="Выполнение" value={formatPercent(summary?.total_progress_percent ?? 0)} />
        <SummaryCard title="Остаток" value={formatAmount(summary?.total_remaining_amount ?? 0)} />
      </Stack>

      {isLoading ? (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Stack spacing={1}>
              <Skeleton variant="text" width={240} height={32} />
              <Skeleton variant="rounded" width="100%" height={90} />
              <Skeleton variant="rounded" width="100%" height={90} />
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && trees.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Stack spacing={1.25}>
              <Typography variant="subtitle1" fontWeight={700}>
                План на выбранный период не создан
              </Typography>
              {canCreateRootPlan ? <Alert severity="info">Создайте первый план на выбранный период.</Alert> : <Alert severity="info">Для этого периода план еще не создан руководителем.</Alert>}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading ? (
        <Stack spacing={1.25}>
          {trees.map((node) => (
            <PlanNodeCard
              key={node.plan_id}
              node={node}
              depth={0}
              onCreateSubplan={(planNode) => {
                setSubplanNode(planNode);
                subplanForm.reset({ name: '', periodStart: planNode.period_start, amount: '' });
              }}
              onDelegate={(planNode) => {
                setDelegateNode(planNode);
                delegateForm.reset({ childUserId: '', childPeriodStart: planNode.period_start, childPlanAmount: '' });
              }}
              onEdit={openEditDialog}
              onDelete={(planNode) => setDeleteNode(planNode)}
              onClosePlan={(planNode) => setCloseNode(planNode)}
            />
          ))}
        </Stack>
      ) : null}

      <Dialog open={isRootDialogOpen} onClose={() => setIsRootDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Создать план</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ mt: 0.5 }}>
            <TextField
              label="Название плана"
              size="small"
              error={Boolean(rootPlanForm.formState.errors.name)}
              helperText={rootPlanForm.formState.errors.name?.message}
              {...rootPlanForm.register('name')}
            />
            <TextField
              type="date"
              label="Дата начала"
              size="small"
              InputLabelProps={{ shrink: true }}
              error={Boolean(rootPlanForm.formState.errors.periodStart)}
              helperText={rootPlanForm.formState.errors.periodStart?.message}
              {...rootPlanForm.register('periodStart')}
            />
            <TextField
              label="Сумма плана"
              size="small"
              error={Boolean(rootPlanForm.formState.errors.planAmount)}
              helperText={rootPlanForm.formState.errors.planAmount?.message}
              {...rootPlanForm.register('planAmount')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRootDialogOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={!canCreateRootPlan || isMutating}
            onClick={rootPlanForm.handleSubmit(async (values) => {
              await createRoot(values.name, parseAmount(values.planAmount), values.periodStart);
              rootPlanForm.reset({ name: '', periodStart: periodToDate(period), planAmount: '' });
              setIsRootDialogOpen(false);
            })}
          >
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(subplanNode)} onClose={() => setSubplanNode(null)} fullWidth maxWidth="sm">
        <DialogTitle>Создать подплан</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Родитель: {subplanNode?.plan_name}
            </Typography>
            <TextField
              label="Название подплана"
              size="small"
              error={Boolean(subplanForm.formState.errors.name)}
              helperText={subplanForm.formState.errors.name?.message}
              {...subplanForm.register('name')}
            />
            <TextField
              type="date"
              label="Дата начала подплана"
              size="small"
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: subplanNode?.period_start, max: subplanNode?.period_end }}
              error={Boolean(subplanForm.formState.errors.periodStart)}
              helperText={subplanForm.formState.errors.periodStart?.message}
              {...subplanForm.register('periodStart')}
            />
            <TextField
              label="Сумма подплана"
              size="small"
              error={Boolean(subplanForm.formState.errors.amount)}
              helperText={subplanForm.formState.errors.amount?.message}
              {...subplanForm.register('amount')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubplanNode(null)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={isMutating}
            onClick={subplanForm.handleSubmit(async (values) => {
              if (!subplanNode) {
                return;
              }
              await createSubplanNodeWithStart(
                subplanNode.plan_id,
                values.name,
                parseAmount(values.amount),
                values.periodStart
              );
              setSubplanNode(null);
            })}
          >
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(delegateNode)} onClose={() => setDelegateNode(null)} fullWidth maxWidth="sm">
        <DialogTitle>Делегировать план</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ mt: 0.5 }}>
            {isCandidatesLoading ? <Alert severity="info">Загрузка подчиненных...</Alert> : null}
            <Typography variant="body2" color="text.secondary">
              План: {delegateNode?.plan_name}
            </Typography>
            <FormControl fullWidth size="small" error={Boolean(delegateForm.formState.errors.childUserId)}>
              <InputLabel id="delegate-child-user-label">Подчиненный</InputLabel>
              <Select
                labelId="delegate-child-user-label"
                label="Подчиненный"
                value={delegateForm.watch('childUserId')}
                onChange={(event) => {
                  delegateForm.setValue('childUserId', event.target.value, { shouldValidate: true });
                }}
              >
                {delegateCandidates.map((candidate) => (
                  <MenuItem key={candidate.user_id} value={candidate.user_id}>
                    {candidate.full_name || candidate.user_id} ({candidate.role_name})
                  </MenuItem>
                ))}
              </Select>
              {delegateForm.formState.errors.childUserId ? (
                <Typography variant="caption" color="error">
                  {delegateForm.formState.errors.childUserId.message}
                </Typography>
              ) : null}
            </FormControl>
            <TextField
              type="date"
              label="Дата начала делегирования"
              size="small"
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: delegateNode?.period_start, max: delegateNode?.period_end }}
              error={Boolean(delegateForm.formState.errors.childPeriodStart)}
              helperText={delegateForm.formState.errors.childPeriodStart?.message}
              {...delegateForm.register('childPeriodStart')}
            />
            <TextField
              label="Сумма делегирования"
              size="small"
              error={Boolean(delegateForm.formState.errors.childPlanAmount)}
              helperText={delegateForm.formState.errors.childPlanAmount?.message}
              {...delegateForm.register('childPlanAmount')}
            />
            {!isCandidatesLoading && delegateCandidates.length === 0 ? (
              <Alert severity="info">Нет доступных прямых подчиненных для делегирования.</Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelegateNode(null)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={isMutating || isCandidatesLoading}
            onClick={delegateForm.handleSubmit(async (values) => {
              if (!delegateNode) {
                return;
              }
              await delegate(
                delegateNode.plan_id,
                values.childUserId,
                parseAmount(values.childPlanAmount),
                values.childPeriodStart
              );
              setDelegateNode(null);
            })}
          >
            Делегировать
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editNode)} onClose={() => setEditNode(null)} fullWidth maxWidth="xs">
        <DialogTitle>Редактирование плана</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {editNode?.user_name}
            </Typography>
            <TextField
              label="Название плана"
              size="small"
              error={Boolean(editForm.formState.errors.name)}
              helperText={editForm.formState.errors.name?.message}
              {...editForm.register('name')}
            />
            <TextField
              label="Новая сумма"
              size="small"
              error={Boolean(editForm.formState.errors.planAmount)}
              helperText={editForm.formState.errors.planAmount?.message}
              {...editForm.register('planAmount')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditNode(null)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={isMutating}
            onClick={editForm.handleSubmit(async (values) => {
              if (!editNode) {
                return;
              }
              await updatePlanNode(editNode.plan_id, {
                name: values.name,
                planAmount: parseAmount(values.planAmount),
              });
              setEditNode(null);
            })}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteNode)} onClose={() => setDeleteNode(null)} fullWidth maxWidth="xs">
        <DialogTitle>Удаление плана</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Удалить план {deleteNode?.plan_name}? Это действие необратимо.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteNode(null)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            disabled={isMutating}
            onClick={async () => {
              if (!deleteNode) {
                return;
              }
              await removeChildPlan(deleteNode.plan_id);
              setDeleteNode(null);
            }}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(closeNode)} onClose={() => setCloseNode(null)} fullWidth maxWidth="xs">
        <DialogTitle>Закрытие плана</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Закрыть план {closeNode?.plan_name}? После закрытия редактирование и делегирование будут недоступны.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseNode(null)}>Отмена</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={isMutating}
            onClick={async () => {
              if (!closeNode) {
                return;
              }
              await closePlanNode(closeNode.plan_id);
              setCloseNode(null);
            }}
          >
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
