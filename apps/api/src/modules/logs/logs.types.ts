export interface LogQueryFilter {
  start_at?: string;
  end_at?: string;
  user_id?: number;
  limit?: number;
}

export interface RequestLogRecord {
  user_id?: number | null;
  ip: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  created_at?: string;
}

export interface ApiCallLogRecord {
  user_id?: number | null;
  task_id?: number | null;
  provider: string;
  endpoint: string;
  status: 'success' | 'failed';
  latency_ms: number;
  error_message?: string;
  created_at?: string;
}

export interface ErrorLogView {
  id: number;
  task_id?: number | null;
  user_id?: number | null;
  source: string;
  code: string;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface RequestLogView extends RequestLogRecord {
  id: number;
  created_at: string;
}

export interface ApiCallLogView extends ApiCallLogRecord {
  id: number;
  task_id?: number | null;
  created_at: string;
}

export interface LogsRepository {
  createRequestLog(record: RequestLogRecord): Promise<void>;
  createApiCallLog(record: ApiCallLogRecord): Promise<void>;
  queryRequestLogs(filter: LogQueryFilter): Promise<RequestLogView[]>;
  queryErrorLogs(filter: LogQueryFilter): Promise<ErrorLogView[]>;
  queryApiCallLogs(filter: LogQueryFilter): Promise<ApiCallLogView[]>;
}
