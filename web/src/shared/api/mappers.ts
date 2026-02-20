import type { AuthLink } from './loginWebUser';
import type { RequestEntity } from '@shared/types/domain';
import type { RequestWithOfferStats } from './getRequests';

type LinksContainer = {
  _links?: {
    available_action?: AuthLink[];
    available_actions?: AuthLink[];
    availableActions?: AuthLink[];
  };
};

export const resolveAvailableActions = (response: LinksContainer): AuthLink[] =>
  response._links?.available_action ?? response._links?.available_actions ?? response._links?.availableActions ?? [];

export const mapRequestEntityToSummary = (item: RequestEntity): RequestWithOfferStats => ({
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
  count_chat_alert: item.stats?.count_chat_alert ?? 0,
  unread_messages_count: item.unread_messages_count ?? 0,
  files: item.files
});
