export type UserEventType =
  | 'click_generate'
  | 'select_style'
  | 'download_image'
  | 'dwell_time';

export interface UserEventRecord {
  user_id: number;
  event_type: UserEventType;
  event_value?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface UserEventsQuery {
  start_at?: string;
  end_at?: string;
  user_id?: number;
}

export interface UserEventsRepository {
  create(record: UserEventRecord): Promise<void>;
  countByType(eventType: UserEventType, query?: UserEventsQuery): Promise<number>;
}
