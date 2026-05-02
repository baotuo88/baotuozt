import type { ErrorLogWriter, FallbackStorage, Logger, S3Storage } from '../queue';
import { withRetry } from './retry';

export interface ResilientStorageConfig {
  s3Attempts?: number;
  s3DelayMs?: number;
  cdnBaseUrl?: string;
}

function toCdnUrl(rawUrl: string, cdnBaseUrl?: string): string {
  if (!cdnBaseUrl) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    const path = parsed.pathname.replace(/^\/+/, '');
    return `${cdnBaseUrl.replace(/\/$/, '')}/${path}`;
  } catch (_error) {
    return rawUrl;
  }
}

export class ResilientStorage {
  constructor(
    private readonly s3Storage: S3Storage,
    private readonly fallbackStorage?: FallbackStorage,
    private readonly logger?: Logger,
    private readonly errorLogWriter?: ErrorLogWriter,
    private readonly config: ResilientStorageConfig = {},
  ) {}

  async upload(input: {
    key: string;
    body: Buffer;
    content_type: string;
    task_id?: number;
    user_id?: number;
  }): Promise<{ url: string; provider: 's3' | 'fallback' }> {
    try {
      const s3 = await withRetry(
        async () => this.s3Storage.upload(input),
        {
          attempts: this.config.s3Attempts ?? 3,
          delayMs: this.config.s3DelayMs ?? 500,
          backoff: 'exponential',
        },
      );

      return { url: toCdnUrl(s3.url, this.config.cdnBaseUrl), provider: 's3' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.errorLogWriter?.write({
        task_id: input.task_id,
        user_id: input.user_id,
        source: 's3',
        code: 'S3_UPLOAD_FAILED',
        message,
        details: { key: input.key },
      });

      this.logger?.error('s3 upload failed after retries', { key: input.key, error: message });

      if (!this.fallbackStorage) {
        throw error;
      }

      const fallback = await this.fallbackStorage.upload(input);
      this.logger?.info('fallback storage used', { key: input.key, url: fallback.url });

      return { url: toCdnUrl(fallback.url, this.config.cdnBaseUrl), provider: 'fallback' };
    }
  }
}
