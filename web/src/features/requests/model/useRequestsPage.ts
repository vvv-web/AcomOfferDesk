import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { getOfferedRequests } from '@shared/api/requests/getOfferedRequests';
import { getOpenRequests } from '@shared/api/requests/getOpenRequests';
import { getRequestEconomists } from '@shared/api/requests/getRequestEconomists';
import { getRequests, type RequestWithOfferStats } from '@shared/api/requests/getRequests';
import { updateRequestDetails } from '@shared/api/requests/updateRequestDetails';
import { hasAvailableAction } from '@shared/auth/availableActions';
import { ROLE } from '@shared/constants/roles';

const POLL_INTERVAL_MS = 10000;

export const useRequestsPage = () => {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState<RequestWithOfferStats[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chatAlertsMap, setChatAlertsMap] = useState<Record<number, number>>({});

  const contractorTabParam = searchParams.get('tab');
  const contractorTab: 'my' | 'open' = contractorTabParam === 'open' ? 'open' : 'my';
  const isContractor = session?.roleId === ROLE.CONTRACTOR;

  const canLoadOpenRequests = useMemo(
    () => hasAvailableAction(session, '/api/v1/requests/open', 'GET'),
    [session]
  );

  const canLoadMyRequests = useMemo(
    () => hasAvailableAction(session, '/api/v1/requests/offered', 'GET'),
    [session]
  );

  const canUseContractorTabs = isContractor && canLoadOpenRequests && canLoadMyRequests;
  const shouldLoadOnlyOpenRequests = isContractor && !canUseContractorTabs && canLoadOpenRequests;
  const shouldLoadOpenRequests = shouldLoadOnlyOpenRequests || (canUseContractorTabs && contractorTab === 'open');

  const canEditOwner = useMemo(
    () => session?.roleId === ROLE.SUPERADMIN || session?.roleId === ROLE.LEAD_ECONOMIST || session?.roleId === ROLE.PROJECT_MANAGER,
    [session?.roleId]
  );

  const fetchRequests = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const data = isContractor
          ? shouldLoadOpenRequests
            ? await getOpenRequests()
            : await getOfferedRequests()
          : await getRequests();

        setRequests(data.requests);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Ошибка загрузки заявок');
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [isContractor, shouldLoadOpenRequests]
  );

  const fetchOwners = useCallback(async () => {
    if (!canEditOwner) {
      setOwnerOptions([]);
      return;
    }

    try {
      const economists = await getRequestEconomists();
      setOwnerOptions(
        economists.map((item) => ({
          id: item.user_id,
          label: `${item.full_name?.trim() || item.user_id} (${item.role})`
        }))
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Ошибка загрузки списка ответственных');
    }
  }, [canEditOwner]);

  useEffect(() => {
    void fetchRequests(true);
    const intervalId = window.setInterval(() => {
      void fetchRequests(false);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [fetchRequests]);

  useEffect(() => {
    void fetchOwners();
  }, [fetchOwners]);

  useEffect(() => {
    if (shouldLoadOpenRequests) {
      setChatAlertsMap({});
      return;
    }

    setChatAlertsMap(
      requests.reduce<Record<number, number>>((acc, request) => {
        const alertCount = request.count_chat_alert ?? 0;
        if (alertCount > 0) {
          acc[request.id] = alertCount;
        }
        return acc;
      }, {})
    );
  }, [requests, shouldLoadOpenRequests]);

  const handleOwnerChange = useCallback(
    async (request: RequestWithOfferStats, ownerUserId: string) => {
      if (!canEditOwner || ownerUserId === request.id_user) {
        return;
      }

      const previousOwner = request.id_user;
      setRequests((prev) =>
        prev.map((item) =>
          item.id === request.id
            ? {
                ...item,
                id_user: ownerUserId
              }
            : item
        )
      );

      try {
        await updateRequestDetails({
          requestId: request.id,
          owner_user_id: ownerUserId
        });
      } catch (error) {
        setRequests((prev) =>
          prev.map((item) =>
            item.id === request.id
              ? {
                  ...item,
                  id_user: previousOwner
                }
              : item
          )
        );
        setErrorMessage(error instanceof Error ? error.message : 'Не удалось изменить ответственного');
      }
    },
    [canEditOwner]
  );

  return {
    canEditOwner,
    chatAlertsMap,
    errorMessage,
    handleOwnerChange,
    isContractor,
    isLoading,
    ownerOptions,
    requests
  };
};
