import { fetchJson } from './client';
import { mapRequestEntityToSummary } from './mappers';
import type { FileEntity, RequestEntity } from '@shared/types/domain';

export type RequestFile = FileEntity;

export type ContractorRequestOffer = {
  id: number;
  status: string;
  unread_messages_count?: number;
};

export type RequestWithOfferStats = {
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
  count_submitted?: number;
  count_deleted_alert?: number;
  count_accepted_total?: number;
  count_rejected_total?: number;
  count_chat_alert?: number;
  unread_messages_count?: number;
  files: RequestFile[];
  offers?: ContractorRequestOffer[];
};

export type GetRequestsResponse = {
  requests: RequestWithOfferStats[];
};

type ApiResponse = {
  data: {
    items: RequestEntity[];
  };
};

export const getRequests = async (): Promise<GetRequestsResponse> => {
  const response = await fetchJson<ApiResponse>(
    '/api/v1/requests',
    { method: 'GET' },
    'Ошибка загрузки заявок'
  );
  return {
    requests: response.data.items.map(mapRequestEntityToSummary)
  };
};