import { fetchJson } from './client';
import type { AuthLink } from './loginWebUser';

export type ContractorRequestViewFile = {
  id: number;
  path: string;
  name: string;
  download_url: string;
};

export type ContractorExistingOffer = {
  offer_id: number;
  status: string;
  status_label: string;
  files: ContractorRequestViewFile[];
};

export type ContractorRequestView = {
  id: number;
  description: string | null;
  status: string;
  status_label: string;
  deadline_at: string;
  owner_user_id: string;
  files: ContractorRequestViewFile[];
  existing_offer: ContractorExistingOffer | null;
  availableActions: AuthLink[];
};

type ApiResponse = {
  data: {
    request_id: number;
    description: string | null;
    status: string;
    status_label: string;
    deadline_at: string;
    owner_user_id: string;
    files: ContractorRequestViewFile[];
    existing_offer: ContractorExistingOffer | null;
  };
  _links?: {
    available_action?: AuthLink[];
    available_actions?: AuthLink[];
    availableActions?: AuthLink[];
  };
};

export const getContractorRequestView = async (requestId: number): Promise<ContractorRequestView> => {
  const response = await fetchJson<ApiResponse>(
    `/api/v1/requests/${requestId}/contractor-view`,
    { method: 'GET' },
    'Ошибка загрузки заявки'
  );

  return {
    id: response.data.request_id,
    description: response.data.description,
    status: response.data.status,
    status_label: response.data.status_label,
    deadline_at: response.data.deadline_at,
    owner_user_id: response.data.owner_user_id,
    files: response.data.files ?? [],
    existing_offer: response.data.existing_offer,
    availableActions:
      response._links?.available_action ??
      response._links?.available_actions ??
      response._links?.availableActions ??
      []
  };
};
