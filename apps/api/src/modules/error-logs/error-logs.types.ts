export type ErrorSource = 'generate-image-task' | 'image2' | 's3' | 'worker' | 'system';

export interface ErrorLogRecord {
  task_id?: number;
  user_id?: number;
  source: ErrorSource;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  created_at?: string;
}

export interface ErrorLogsRepository {
  create(record: ErrorLogRecord): Promise<void>;
}
