import type { GenerateMode } from '../../style-system';
import type { ErrorLogWriter, Image2Client, Logger } from '../queue';
import { ApiKeyPool } from './api-key-pool';
import { withRetry } from '../reliability';

export interface Image2FailoverClientConfig {
  model: string;
  timeoutMs?: number;
  retriesPerKey?: number;
}

interface Image2Response {
  image_base64: string;
  mime_type?: string;
}

function isQuotaExceededError(reason: string): boolean {
  const lower = reason.toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('insufficient_quota') ||
    lower.includes('credit') ||
    lower.includes('balance') ||
    lower.includes('429')
  );
}

export class Image2FailoverClient implements Image2Client {
  constructor(
    private readonly keyPool: ApiKeyPool,
    private readonly config: Image2FailoverClientConfig,
    private readonly logger?: Logger,
    private readonly errorLogWriter?: ErrorLogWriter,
  ) {}

  async generate(input: {
    prompt: string;
    negative_prompt: string;
    mode: GenerateMode;
    model_type?: string;
    image_url?: string | null;
    task_id?: number;
    user_id?: number;
  }): Promise<{ image_buffer: Buffer; mime_type: string }> {
    const model = input.model_type || this.config.model;
    const candidates = await this.keyPool.getOrderedCandidates(model);
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        const response = await withRetry(
          async () =>
            this.callImage2(candidate.base_url, candidate.api_key, {
              model: candidate.model || model,
              prompt: input.prompt,
              negative_prompt: input.negative_prompt,
              mode: input.mode,
              image_url: input.image_url,
            }),
          {
            attempts: this.config.retriesPerKey ?? 3,
            delayMs: 800,
            backoff: 'exponential',
            shouldRetry: (error) => {
              const reason = error instanceof Error ? error.message : String(error);
              return (
                reason.includes('TIMEOUT') ||
                reason.includes('ABORT') ||
                reason.includes('IMAGE2_HTTP_5')
              );
            },
          },
        );

        this.logger?.info('image2 request success', {
          api_config_id: candidate.id,
          model: candidate.model,
          base_url: candidate.base_url,
        });

        return {
          image_buffer: Buffer.from(response.image_base64, 'base64'),
          mime_type: response.mime_type ?? 'image/png',
        };
      } catch (error) {
        lastError = error;
        const reason = error instanceof Error ? error.message : String(error);

        if (isQuotaExceededError(reason)) {
          await this.keyPool.disable(candidate.id, reason);
        } else {
          await this.keyPool.markFailed(candidate.id, reason);
        }

        await this.errorLogWriter?.write({
          task_id: input.task_id,
          user_id: input.user_id,
          source: 'image2',
          code: isQuotaExceededError(reason) ? 'IMAGE2_QUOTA_EXCEEDED' : 'IMAGE2_REQUEST_FAILED',
          message: reason,
          details: {
            api_config_id: candidate.id,
            base_url: candidate.base_url,
            model: candidate.model,
          },
        });

        this.logger?.error('image2 request failed, switch to next key', {
          api_config_id: candidate.id,
          base_url: candidate.base_url,
          disabled: isQuotaExceededError(reason),
          reason,
        });
      }
    }

    throw lastError instanceof Error ? lastError : new Error('ALL_API_KEYS_FAILED');
  }

  private async callImage2(
    baseUrl: string,
    apiKey: string,
    body: {
      model: string;
      prompt: string;
      negative_prompt: string;
      mode: GenerateMode;
      image_url?: string | null;
    },
  ): Promise<Image2Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30000);

    try {
      const endpoint = `${baseUrl.replace(/\/$/, '')}/images/generations`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`IMAGE2_HTTP_${response.status}:${text}`);
      }

      const json = (await response.json()) as Partial<Image2Response>;
      if (!json.image_base64) {
        throw new Error('IMAGE2_INVALID_RESPONSE');
      }

      return {
        image_base64: json.image_base64,
        mime_type: json.mime_type,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        throw new Error('IMAGE2_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
