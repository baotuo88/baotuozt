import type { GenerateMode } from '../../style-system';
import type { EcommerceMode } from '../../ecommerce';

export type TaskStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface TaskUpdateOptions {
  onlyIfCurrentIn?: TaskStatus[];
  skipIfCanceled?: boolean;
}

export interface ImageTaskJobData {
  task_id: number;
  user_id: number;
  mode: GenerateMode;
  style_id: number;
  style_version: number;
  ecommerce_mode?: EcommerceMode;
  credit_deduction_id: string;
  prompt_hash: string;
  prompt: string;
  negative_prompt: string;
  use_new_model?: boolean;
  image_url?: string | null;
}

export interface CreditsRollbackGateway {
  rollbackByTaskId(taskId: number): Promise<void>;
}

export interface TaskRepository {
  updateStatus(
    taskId: number,
    status: TaskStatus,
    patch?: Record<string, unknown>,
    options?: TaskUpdateOptions,
  ): Promise<boolean>;
}

export interface ImageCacheWriter {
  upsert(item: { prompt_hash: string; image_url: string }): Promise<void>;
}

export interface Image2Client {
  generate(input: {
    prompt: string;
    negative_prompt: string;
    mode: GenerateMode;
    model_type?: string;
    image_url?: string | null;
    task_id?: number;
    user_id?: number;
  }): Promise<{ image_buffer: Buffer; mime_type: string }>;
}

export interface S3Storage {
  upload(input: {
    key: string;
    body: Buffer;
    content_type: string;
  }): Promise<{ url: string }>;
}

export interface FallbackStorage {
  upload(input: {
    key: string;
    body: Buffer;
    content_type: string;
  }): Promise<{ url: string }>;
}

export interface ErrorLogWriter {
  write(record: {
    task_id?: number;
    user_id?: number;
    source: 'generate-image-task' | 'image2' | 's3' | 'worker' | 'system';
    code: string;
    message: string;
    details?: Record<string, unknown>;
    created_at?: string;
  }): Promise<void>;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
