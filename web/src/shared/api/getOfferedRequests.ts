import { fetchJson } from './client';
import type { ContractorRequestOffer, GetRequestsResponse } from './getRequests';
import type { FileEntity } from '@shared/types/domain';

type ApiContractorRequestOffer = {
  id?: number;
  offer_id?: number;
  status: string;
  unread_messages_count: number;
};

type ApiResponse = {
  data: {
    items: Array<{
      request_id: number;
      description: string | null;
      status: string;
      status_label: string;
      deadline_at: string;
      created_at: string;
      updated_at: string;
      closed_at: string | null;
      owner_user_id: string;
      chosen_offer_id: number | null;
      files: FileEntity[];
      offers: ApiContractorRequestOffer[];
    }>;
  };
};

const mapContractorOffer = (offer: ApiContractorRequestOffer): ContractorRequestOffer => ({
  id: offer.id ?? offer.offer_id ?? 0,
  status: offer.status,
  unread_messages_count: offer.unread_messages_count
});


export const getOfferedRequests = async (): Promise<GetRequestsResponse> => {
  const response = await fetchJson<ApiResponse>(
    '/api/v1/requests/offered',
    { method: 'GET' },
    'Ошибка загрузки заявок контрагента'
  );

  return {
    requests: response.data.items.map((item) => ({
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
      files: item.files,
      offers: item.offers.map(mapContractorOffer)
    }))
  };
};
