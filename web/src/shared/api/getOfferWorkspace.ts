import { fetchJson } from './client';
import type { AuthLink } from './loginWebUser';
import type { ContractorRequestViewFile } from './getContractorRequestView';
import { resolveAvailableActions } from './mappers';

export type WorkspaceOfferItem = {
  offer_id: number;
  contractor_user_id?: string;
  status: string;
  status_label: string;
  created_at: string | null;
  updated_at: string | null;
  files: ContractorRequestViewFile[];
  availableActions: AuthLink[];
  selfHref?: string;
};

export type OfferWorkspace = {
  request: {
    request_id: number;
    description: string | null;
    status: string;
    status_label: string;
    chosen_offer_id?: number | null;
    id_offer?: number | null;
    owner_user_id?: string;
    deadline_at: string;
    created_at: string | null;
    updated_at: string | null;
    closed_at: string | null;
    files: ContractorRequestViewFile[];
  };
  offer: WorkspaceOfferItem;
  offers: WorkspaceOfferItem[];
  profile: {
    full_name: string;
    phone: string;
    mail: string;
  } | null;
  company_contacts: {
    company_name: string;
    inn: string;
    phone: string;
    mail: string;
    address: string;
    note: string;
  } | null;
  availableActions: AuthLink[];
};

type ApiOfferItem = Omit<WorkspaceOfferItem, 'availableActions' | 'selfHref' | 'files'> & {
  files?: ContractorRequestViewFile[];
  _links?: {
    self?: AuthLink;
    available_action?: AuthLink[];
    available_actions?: AuthLink[];
    availableActions?: AuthLink[];
  };
};

type ApiResponse = {
  data: {
    request: OfferWorkspace['request'];
    offer: ApiOfferItem;
    offers?: ApiOfferItem[];
    contractor?: {
      user_id: string;
      full_name: string | null;
      phone: string | null;
      mail: string | null;
      company_name: string | null;
      inn: string | null;
      company_phone: string | null;
      company_mail: string | null;
      address: string | null;
      note: string | null;
    };
  };
  _links?: {
    available_action?: AuthLink[];
    available_actions?: AuthLink[];
    availableActions?: AuthLink[];
  };
};

const mapOfferItem = (offer: ApiOfferItem, contractorUserId?: string): WorkspaceOfferItem => ({
  offer_id: offer.offer_id,
  contractor_user_id: contractorUserId,
  status: offer.status,
  status_label: offer.status_label,
  created_at: offer.created_at,
  updated_at: offer.updated_at,
  files: offer.files ?? [],
  availableActions: resolveAvailableActions(offer),
  selfHref: offer._links?.self?.href
});

export const getOfferWorkspace = async (offerId: number): Promise<OfferWorkspace> => {
  const response = await fetchJson<ApiResponse>(
    `/api/v1/offers/${offerId}/workspace`,
    { method: 'GET' },
    'Ошибка загрузки workspace оффера'
  );

  const availableActions = resolveAvailableActions(response);
  const contractorUserId = response.data.contractor?.user_id;

  const normalizedCurrentOffer = mapOfferItem(response.data.offer, contractorUserId);
  const normalizedOffers = (response.data.offers ?? []).map((offer) => mapOfferItem(offer, contractorUserId));

  return {
    request: {
      ...response.data.request,
      files: response.data.request.files ?? []
    },
    offer: normalizedCurrentOffer,
    offers: normalizedOffers.length > 0 ? normalizedOffers : [normalizedCurrentOffer],
    profile: response.data.contractor
      ? {
          full_name: response.data.contractor.full_name ?? '',
          phone: response.data.contractor.phone ?? '',
          mail: response.data.contractor.mail ?? ''
        }
      : null,
    company_contacts: response.data.contractor
      ? {
          company_name: response.data.contractor.company_name ?? '',
          inn: response.data.contractor.inn ?? '',
          phone: response.data.contractor.company_phone ?? '',
          mail: response.data.contractor.company_mail ?? '',
          address: response.data.contractor.address ?? '',
          note: response.data.contractor.note ?? ''
        }
      : null,
    availableActions
  };
};
