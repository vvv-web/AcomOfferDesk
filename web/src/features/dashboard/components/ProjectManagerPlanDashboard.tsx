import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@app/providers/AuthProvider";
import type { PlanDelegateCandidate, PlanTreeNode } from "@shared/api/plans";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { usePlanDashboard } from "../model/usePlanDashboard";
import { PlanDialogs } from "./plan/PlanDialogs";
import { PlanHierarchySection } from "./plan/PlanHierarchySection";
import {
  PlanAnalyticsCards,
  PlanKpiRow,
  PlanPageHeader,
  planSectionCardSx,
} from "./plan/PlanOverviewSections";
import {
  delegateSchema,
  editSchema,
  parseAmount,
  rootPlanSchema,
  subplanSchema,
  type DelegateFormValues,
  type EditFormValues,
  type RootPlanFormValues,
  type SubplanFormValues,
} from "./plan/planDashboardForms";
import {
  ALL_SUBORDINATES_SCOPE,
  buildDistributionItems,
  buildExecutionSlices,
  buildPlanFilterOptions,
  buildRequestFactMetrics,
  buildSideSummaryData,
  collectSubordinateOptions,
  countUniqueParticipants,
  deriveSummaryFromTrees,
  filterPlanTree,
  findPlanNodeByPlanId,
  findSubtreeByUserId,
  formatPeriodLabel,
  getExpandableNodeIds,
  normalizePlanTreesForPresentation,
  periodToDate,
} from "./plan/planDashboardUtils";

const emptyCardSx = {
  ...planSectionCardSx,
  backgroundColor: "#ffffff",
};

export const ProjectManagerPlanDashboard = () => {
  const { session } = useAuth();
  const {
    period,
    setPeriod,
    summary,
    trees,
    isLoading,
    isMutating,
    canCreateRootPlan,
    rootPlanExists,
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
  const [delegateCandidates, setDelegateCandidates] = useState<
    PlanDelegateCandidate[]
  >([]);
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(false);
  const [editNode, setEditNode] = useState<PlanTreeNode | null>(null);
  const [deleteNode, setDeleteNode] = useState<PlanTreeNode | null>(null);
  const [closeNode, setCloseNode] = useState<PlanTreeNode | null>(null);
  const [selectedScopeUserId, setSelectedScopeUserId] = useState<string>(
    ALL_SUBORDINATES_SCOPE,
  );
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [expandedNodeIds, setExpandedNodeIds] = useState<
    Record<number, boolean>
  >({});

  const rootPlanForm = useForm<RootPlanFormValues>({
    resolver: zodResolver(rootPlanSchema),
    defaultValues: {
      name: "",
      periodStart: periodToDate(period),
      planAmount: "",
    },
  });
  const subplanForm = useForm<SubplanFormValues>({
    resolver: zodResolver(subplanSchema),
    defaultValues: { name: "", periodStart: periodToDate(period), amount: "" },
  });
  const delegateForm = useForm<DelegateFormValues>({
    resolver: zodResolver(delegateSchema),
    defaultValues: {
      childUserId: "",
      childPeriodStart: periodToDate(period),
      childPlanAmount: "",
    },
  });
  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", planAmount: "" },
  });

  useEffect(() => {
    rootPlanForm.setValue("periodStart", periodToDate(period));
    if (!subplanNode) {
      subplanForm.setValue("periodStart", periodToDate(period));
    }
    if (!delegateNode) {
      delegateForm.setValue("childPeriodStart", periodToDate(period));
    }
  }, [
    delegateForm,
    delegateNode,
    period,
    rootPlanForm,
    subplanForm,
    subplanNode,
  ]);

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

  const subordinateOptions = useMemo(
    () => collectSubordinateOptions(trees),
    [trees],
  );
  const periodLabel = useMemo(() => formatPeriodLabel(period), [period]);

  const selectedScopeExists =
    selectedScopeUserId === ALL_SUBORDINATES_SCOPE ||
    subordinateOptions.some((option) => option.userId === selectedScopeUserId);

  useEffect(() => {
    if (!selectedScopeExists) {
      setSelectedScopeUserId(ALL_SUBORDINATES_SCOPE);
    }
  }, [selectedScopeExists]);

  const scopedTrees = useMemo(() => {
    if (selectedScopeUserId === ALL_SUBORDINATES_SCOPE) {
      return trees;
    }

    return trees
      .map((rootNode) => findSubtreeByUserId(rootNode, selectedScopeUserId))
      .filter((node): node is PlanTreeNode => node !== null);
  }, [selectedScopeUserId, trees]);

  const planOptions = useMemo(
    () => buildPlanFilterOptions(scopedTrees),
    [scopedTrees],
  );
  const selectedPlanExists =
    selectedPlanId === null ||
    planOptions.some((option) => option.planId === selectedPlanId);

  useEffect(() => {
    if (!selectedPlanExists) {
      setSelectedPlanId(null);
    }
  }, [selectedPlanExists]);

  const presentationTrees = useMemo(
    () => normalizePlanTreesForPresentation(scopedTrees),
    [scopedTrees],
  );
  const expandableNodeIds = useMemo(
    () => getExpandableNodeIds(presentationTrees),
    [presentationTrees],
  );
  const selectedPlanTree = useMemo(
    () =>
      selectedPlanId
        ? findPlanNodeByPlanId(presentationTrees, selectedPlanId)
        : null,
    [presentationTrees, selectedPlanId],
  );

  useEffect(() => {
    setExpandedNodeIds((prev) => {
      const next = { ...prev };
      expandableNodeIds.forEach((planId) => {
        if (next[planId] === undefined) {
          next[planId] = true;
        }
      });
      return next;
    });
  }, [expandableNodeIds]);

  const visibleTrees = useMemo(() => {
    const sourceTrees = selectedPlanTree
      ? [selectedPlanTree]
      : presentationTrees;
    if (!searchValue.trim()) {
      return sourceTrees;
    }

    return sourceTrees
      .map((node) => filterPlanTree(node, searchValue))
      .filter((node): node is PlanTreeNode => node !== null);
  }, [presentationTrees, searchValue, selectedPlanTree]);

  const scopedSummary = useMemo(
    () =>
      selectedScopeUserId === ALL_SUBORDINATES_SCOPE && summary
        ? summary
        : deriveSummaryFromTrees(scopedTrees),
    [scopedTrees, selectedScopeUserId, summary],
  );
  const participantCount = useMemo(
    () => countUniqueParticipants(scopedTrees),
    [scopedTrees],
  );
  const distributionItems = useMemo(
    () => buildDistributionItems(scopedTrees),
    [scopedTrees],
  );
  const executionSlices = useMemo(
    () => buildExecutionSlices(scopedTrees),
    [scopedTrees],
  );
  const requestFactMetrics = useMemo(
    () => buildRequestFactMetrics(scopedSummary),
    [scopedSummary],
  );
  const sideSummary = useMemo(
    () => buildSideSummaryData(scopedTrees, session?.userId ?? null),
    [scopedTrees, session?.userId],
  );
  const forceExpanded = Boolean(searchValue.trim());

  const openEditDialog = (node: PlanTreeNode) => {
    setEditNode(node);
    editForm.reset({
      name: node.plan_name,
      planAmount: node.plan_amount.toFixed(2),
    });
  };

  const hierarchyHandlers = {
    onCreateSubplan: (planNode: PlanTreeNode) => {
      setSubplanNode(planNode);
      subplanForm.reset({
        name: "",
        periodStart: planNode.period_start,
        amount: "",
      });
    },
    onDelegate: (planNode: PlanTreeNode) => {
      setDelegateNode(planNode);
      delegateForm.reset({
        childUserId: "",
        childPeriodStart: planNode.period_start,
        childPlanAmount: "",
      });
    },
    onEdit: openEditDialog,
    onDelete: (planNode: PlanTreeNode) => setDeleteNode(planNode),
    onClosePlan: (planNode: PlanTreeNode) => setCloseNode(planNode),
  };

  const applyPlanSelection = (planId: number | null) => {
    setSelectedPlanId(planId);
    if (planId === null) {
      setExpandedNodeIds((prev) => {
        const next = { ...prev };
        expandableNodeIds.forEach((id) => {
          next[id] = true;
        });
        return next;
      });
      return;
    }

    const subtree = findPlanNodeByPlanId(presentationTrees, planId);
    if (!subtree) {
      return;
    }
    const subtreeExpandable = getExpandableNodeIds([subtree]);
    setExpandedNodeIds(
      subtreeExpandable.reduce<Record<number, boolean>>((acc, id) => {
        acc[id] = true;
        return acc;
      }, {}),
    );
  };

  const togglePlanSelection = (planId: number) => {
    applyPlanSelection(selectedPlanId === planId ? null : planId);
  };

  return (
    <Stack
      spacing={1.35}
      sx={{
        backgroundColor: "transparent",
        borderRadius: 4,
        p: { xs: 0.5, md: 0.75 },
      }}
    >
      
      <PlanPageHeader
        period={period}
        selectedScopeUserId={selectedScopeUserId}
        subordinateOptions={subordinateOptions}
        canCreateRootPlan={canCreateRootPlan}
        isMutating={isMutating}
        onPeriodChange={setPeriod}
        onScopeChange={setSelectedScopeUserId}
        onAddPlan={() => setIsRootDialogOpen(true)}
      />
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {successMessage ? (
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      ) : null}
      <PlanKpiRow
        totalPlanAmount={scopedSummary.total_plan_amount}
        totalFactAmount={scopedSummary.total_fact_amount}
        totalProgressPercent={scopedSummary.total_progress_percent}
        totalRemainingAmount={scopedSummary.total_remaining_amount}
        participantCount={participantCount}
      />
      {isLoading ? (
        <Card sx={emptyCardSx}>
          
          <CardContent sx={{ p: { xs: 1.35, md: 1.6 } }}>
            
            <Stack spacing={1}>
              
              <Skeleton variant="rounded" width="100%" height={96} />
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
                
                <Skeleton variant="rounded" width="100%" height={228} />
                <Skeleton variant="rounded" width="100%" height={228} />
                <Skeleton variant="rounded" width="100%" height={228} />
              </Box>
              <Skeleton variant="rounded" width="100%" height={320} />
            </Stack>
          </CardContent>
        </Card>
      ) : null}
      {!isLoading && !rootPlanExists ? (
        <Card sx={emptyCardSx}>
          
          <CardContent sx={{ py: 5.5 }}>
            
            <Stack spacing={1.25} alignItems="center" textAlign="center">
              
              <Box
                sx={{
                  width: 82,
                  height: 82,
                  borderRadius: "28px",
                  bgcolor: alpha("#3b82f6", 0.08),
                  color: "primary.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  fontWeight: 800,
                }}
              >
                
                ₽
              </Box>
              <Typography variant="h5" fontWeight={800}>
                
                План на выбранный период еще не создан
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 560 }}
              >
                
                Создайте общий план и распределите его между подчиненными, чтобы
                страница заполнилась метриками и иерархией.
              </Typography>
              {canCreateRootPlan ? (
                <Button
                  variant="contained"
                  onClick={() => setIsRootDialogOpen(true)}
                  disabled={isMutating}
                  sx={{ minWidth: 180 }}
                >
                  
                  Добавить план
                </Button>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
      {!isLoading && rootPlanExists ? (
        <>
          
          <PlanAnalyticsCards
            totalPlanAmount={scopedSummary.total_plan_amount}
            totalFactAmount={scopedSummary.total_fact_amount}
            totalProgressPercent={scopedSummary.total_progress_percent}
            totalRemainingAmount={scopedSummary.total_remaining_amount}
            periodLabel={periodLabel}
            distributionItems={distributionItems}
            executionSlices={executionSlices}
            selectedPlanId={selectedPlanId}
            requestFactMetrics={requestFactMetrics}
            onExecutionSliceClick={togglePlanSelection}
            onDistributionItemClick={togglePlanSelection}
            onClearPlanSelection={() => applyPlanSelection(null)}
          />
          <PlanHierarchySection
            trees={visibleTrees}
            searchValue={searchValue}
            expandedNodeIds={expandedNodeIds}
            forceExpanded={forceExpanded}
            handlers={hierarchyHandlers}
            sideSummary={sideSummary}
            onSearchChange={setSearchValue}
            onToggleNode={(planId) =>
              setExpandedNodeIds((prev) => ({
                ...prev,
                [planId]: !prev[planId],
              }))
            }
            onExpandAll={() =>
              setExpandedNodeIds(
                expandableNodeIds.reduce<Record<number, boolean>>(
                  (acc, planId) => {
                    acc[planId] = true;
                    return acc;
                  },
                  {},
                ),
              )
            }
            onCollapseAll={() =>
              setExpandedNodeIds(
                expandableNodeIds.reduce<Record<number, boolean>>(
                  (acc, planId) => {
                    acc[planId] = false;
                    return acc;
                  },
                  {},
                ),
              )
            }
          />
        </>
      ) : null}
      <PlanDialogs
        isMutating={isMutating}
        canCreateRootPlan={canCreateRootPlan}
        rootDialogOpen={isRootDialogOpen}
        subplanNode={subplanNode}
        delegateNode={delegateNode}
        delegateCandidates={delegateCandidates}
        isCandidatesLoading={isCandidatesLoading}
        editNode={editNode}
        deleteNode={deleteNode}
        closeNode={closeNode}
        rootPlanForm={rootPlanForm}
        subplanForm={subplanForm}
        delegateForm={delegateForm}
        editForm={editForm}
        onCloseRootDialog={() => setIsRootDialogOpen(false)}
        onCloseSubplanDialog={() => setSubplanNode(null)}
        onCloseDelegateDialog={() => setDelegateNode(null)}
        onCloseEditDialog={() => setEditNode(null)}
        onCloseDeleteDialog={() => setDeleteNode(null)}
        onCloseCloseDialog={() => setCloseNode(null)}
        onSubmitRoot={rootPlanForm.handleSubmit(async (values) => {
          await createRoot(
            values.name,
            parseAmount(values.planAmount),
            values.periodStart,
          );
          rootPlanForm.reset({
            name: "",
            periodStart: periodToDate(period),
            planAmount: "",
          });
          setIsRootDialogOpen(false);
        })}
        onSubmitSubplan={subplanForm.handleSubmit(async (values) => {
          if (!subplanNode) {
            return;
          }
          await createSubplanNodeWithStart(
            subplanNode.plan_id,
            values.name,
            parseAmount(values.amount),
            values.periodStart,
          );
          setSubplanNode(null);
        })}
        onSubmitDelegate={delegateForm.handleSubmit(async (values) => {
          if (!delegateNode) {
            return;
          }
          await delegate(
            delegateNode.plan_id,
            values.childUserId,
            parseAmount(values.childPlanAmount),
            values.childPeriodStart,
          );
          setDelegateNode(null);
        })}
        onSubmitEdit={editForm.handleSubmit(async (values) => {
          if (!editNode) {
            return;
          }
          await updatePlanNode(editNode.plan_id, {
            name: values.name,
            planAmount: parseAmount(values.planAmount),
          });
          setEditNode(null);
        })}
        onConfirmDelete={async () => {
          if (!deleteNode) {
            return;
          }
          await removeChildPlan(deleteNode.plan_id);
          setDeleteNode(null);
        }}
        onConfirmClose={async () => {
          if (!closeNode) {
            return;
          }
          await closePlanNode(closeNode.plan_id);
          setCloseNode(null);
        }}
      />
    </Stack>
  );
};
