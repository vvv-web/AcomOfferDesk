export type EntityId = number;

export type RequestStatus = 'open' | 'review' | 'closed' | 'cancelled';
export type OfferStatus = 'submitted' | 'deleted' | 'accepted' | 'rejected';
export type MessageStatus = 'send' | 'received' | 'read';

export type RequestStats = {
  count_submitted: number;
  count_deleted_alert: number;
  count_accepted_total: number;
  count_rejected_total: number;
  count_chat_alert?: number;
};

export type FileEntity = {
  id: EntityId;
  path: string;
  name: string;
  download_url: string;
};

export type RequestEntity = {
  request_id: EntityId;
  description: string | null;
  status: RequestStatus | string;
  status_label: string;
  deadline_at: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  owner_user_id: string;
  chosen_offer_id: EntityId | null;
  unread_messages_count?: number;
  stats?: RequestStats;
  files: FileEntity[];
};

export type OfferMessageEntity = {
  id: EntityId;
  user_id: string;
  user_full_name: string | null;
  text: string;
  created_at: string;
  updated_at: string;
  status: MessageStatus;
};
