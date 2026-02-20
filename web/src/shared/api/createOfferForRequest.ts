import { fetchJson } from './client';
import type { AuthLink } from './loginWebUser';

type ApiResponse = {
  data: {
    offer_id: number;
    request_id: number;
  };
  _links?: {
    self?: AuthLink;
  };
};

export type CreatedOffer = {
  offerId: number;
  requestId: number;
  workspacePath: string;
};

export const createOfferForRequest = async (requestId: number, action?: AuthLink): Promise<CreatedOffer> => {
  const response = await fetchJson<ApiResponse>(
    action?.href ?? `/api/v1/requests/${requestId}/offers`,
    {
      method: action?.method ?? 'POST',
      body: JSON.stringify({})
    },
    'Не удалось создать отклик'
  );

  return {
    offerId: response.data.offer_id,
    requestId: response.data.request_id,
    workspacePath: `/offers/${response.data.offer_id}/workspace`
  };
};
