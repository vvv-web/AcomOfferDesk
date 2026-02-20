import { fetchJson } from './client';
import type { AuthLink } from './loginWebUser';
import { resolveAvailableActions } from './mappers';
import type { FileEntity, RequestEntity } from '@shared/types/domain';

export type RequestDetailsFile = FileEntity;

export type RequestDetailsOffer = {
  offer_id: number;
  status: string | null;
  created_at: string;
  updated_at: string;
  status_label?: string | null;
  offer_workspace_url?: string | null;
  contractor_user_id?: string | null;
  contractor_company_name?: string | null;
  contractor_full_name?: string | null;
  contractor_phone?: string | null;
  contractor_mail?: string | null;
  contractor_address?: string | null;
  contractor_note?: string | null;
  contractor_inn?: string | null;
  contractor_company_phone?: string | null;
  contractor_company_mail?: string | null;
  contractor_contact_phone?: string | null;
  contractor_contact_mail?: string | null;
  unread_messages_count?: number | null;
  offer_chat_stats?: {
    status_web: boolean | null;
    status_tg: boolean | null;
    updated_at?: string | null;
  } | null;
  files: RequestDetailsFile[];
};

export type RequestDetails = {
  id: number;
  id_user: string;
  status: string;
  status_label: string;
  deadline_at: string;
  closed_at: string | null;
  id_offer: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  count_submitted: number;
  count_deleted_alert: number;
  count_accepted_total: number;
  count_rejected_total: number;
  files: RequestDetailsFile[];
  offers: RequestDetailsOffer[];
  availableActions: AuthLink[];
};

type ApiRequestItem = RequestEntity & {
  files: RequestDetailsFile[];
  offers?: RequestDetailsOffer[];
};

type ApiResponse = {
  data: {
    item: ApiRequestItem;
  };
  _links?: {
    available_action?: AuthLink[];
    available_actions?: AuthLink[];
    availableActions?: AuthLink[];
  };
};

export const getRequestDetails = async (requestId: number): Promise<RequestDetails> => {
  const response = await fetchJson<ApiResponse>(
    `/api/v1/requests/${requestId}`,
    { method: 'GET' },
    'Ошибка загрузки заявки'
  );

  const item = response.data.item;

  return {
    id: item.request_id,
    id_user: item.owner_user_id,
    status: item.status,
    status_label: item.status_label,
    deadline_at: item.deadline_at,
    closed_at: item.closed_at,
    id_offer: item.chosen_offer_id,
    description: item.description,
    created_at: item.created_at,
    updated_at: item.updated_at,
    count_submitted: item.stats?.count_submitted ?? 0,
    count_deleted_alert: item.stats?.count_deleted_alert ?? 0,
    count_accepted_total: item.stats?.count_accepted_total ?? 0,
    count_rejected_total: item.stats?.count_rejected_total ?? 0,
    files: item.files ?? [],
    offers: item.offers ?? [],
    availableActions: resolveAvailableActions(response)
  };
};
