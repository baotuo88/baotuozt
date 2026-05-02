import type { GenerateMode } from '../../style-system';
import type { ErrorLogWriter, Image2Client, Logger } from '../queue';
import { withRetry } from '../reliability';
import type { LogsService } from '../../logs';

export type ProviderStatus = 'active' | 'inactive' | 'error';

export interface ModelProvider {
  id: number;
  name: string;
  base_url: string;
  api_key: string;
  model_type: string;
  priority: number;
  status: ProviderStatus;
}

export interface ModelProviderRepository {
  listByModelType(modelType: string): Promise<ModelProvider[]>;
  markError(providerId: number, reason: string): Promise<void>;
  disable(providerId: number, reason: string): Promise<void>;
}

export interface MultiModelRouterConfig {
  modelType?: string;
  defaultModelType?: string;
  timeoutMs?: number;
  retriesPerProvider?: number;
}

interface ProviderResponse {
  image_base64: string;
  mime_type?: string;
}

function isQuotaExceeded(reason: string): boolean {
  const lower = reason.toLowerCase();
  return lower.includes('quota') || lower.includes('429') || lower.includes('rate limit');
}

export class MultiModelProviderRouter implements Image2Client {
  private cursorByModel = new Map<string, number>();

  constructor(
    private readonly repository: ModelProviderRepository,
    private readonly config: MultiModelRouterConfig,
    private readonly logger?: Logger,
    private readonly errorLogWriter?: ErrorLogWriter,
    private readonly logsService?: LogsService,
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
    const modelType = input.model_type || this.config.defaultModelType || this.config.modelType;
    if (!modelType) {
      throw new Error('MODEL_TYPE_NOT_CONFIGURED');
    }

    const providers = await this.getOrderedProviders(modelType);
    let lastError: unknown;

    for (const provider of providers) {
      const callStartedAt = Date.now();
      try {
        const payload = {
          model: provider.model_type,
          prompt: input.prompt,
          negative_prompt: input.negative_prompt,
          mode: input.mode,
          image_url: input.image_url,
        };

        const response = await withRetry(
          async () => this.callProvider(provider.base_url, provider.api_key, payload),
          {
            attempts: this.config.retriesPerProvider ?? 3,
            delayMs: 800,
            backoff: 'exponential',
            shouldRetry: (error) => {
              const reason = error instanceof Error ? error.message : String(error);
              return reason.includes('TIMEOUT') || reason.includes('HTTP_5');
            },
          },
        );

        this.logger?.info('model provider success', {
          provider_id: provider.id,
          provider: provider.name,
          model_type: provider.model_type,
        });

        await this.logsService?.writeApiCallLog({
          user_id: input.user_id,
          task_id: input.task_id,
          provider: provider.name,
          endpoint: `${provider.base_url.replace(/\/$/, '')}/images/generations`,
          status: 'success',
          latency_ms: Date.now() - callStartedAt,
        });

        return {
          image_buffer: Buffer.from(response.image_base64, 'base64'),
          mime_type: response.mime_type ?? 'image/png',
        };
      } catch (error) {
        lastError = error;
        const reason = error instanceof Error ? error.message : String(error);

        if (isQuotaExceeded(reason)) {
          await this.repository.disable(provider.id, reason);
        } else {
          await this.repository.markError(provider.id, reason);
        }

        await this.errorLogWriter?.write({
          task_id: input.task_id,
          user_id: input.user_id,
          source: 'image2',
          code: 'MODEL_PROVIDER_FAILED',
          message: reason,
          details: {
            provider_id: provider.id,
            provider: provider.name,
            model_type: provider.model_type,
          },
        });

        this.logger?.error('model provider failed, fallback next provider', {
          provider_id: provider.id,
          provider: provider.name,
          reason,
        });

        await this.logsService?.writeApiCallLog({
          user_id: input.user_id,
          task_id: input.task_id,
          provider: provider.name,
          endpoint: `${provider.base_url.replace(/\/$/, '')}/images/generations`,
          status: 'failed',
          latency_ms: Date.now() - callStartedAt,
          error_message: reason,
        });
      }
    }

    throw lastError instanceof Error ? lastError : new Error('ALL_MODEL_PROVIDERS_FAILED');
  }

  private async getOrderedProviders(modelType: string): Promise<ModelProvider[]> {
    const providers = await this.repository.listByModelType(modelType);
    const active = providers
      .filter((item) => item.status === 'active')
      .sort((a, b) => a.priority - b.priority || a.id - b.id);

    if (active.length === 0) {
      throw new Error('NO_ACTIVE_MODEL_PROVIDER');
    }

    const current = this.cursorByModel.get(modelType) ?? 0;
    const start = current % active.length;
    const rotated = [...active.slice(start), ...active.slice(0, start)];
    this.cursorByModel.set(modelType, (start + 1) % active.length);
    return rotated;
  }

  private async callProvider(
    baseUrl: string,
    apiKey: string,
    body: {
      model: string;
      prompt: string;
      negative_prompt: string;
      mode: GenerateMode;
      image_url?: string | null;
    },
  ): Promise<ProviderResponse> {
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
        throw new Error(`PROVIDER_HTTP_${response.status}:${text}`);
      }

      const json = (await response.json()) as Partial<ProviderResponse>;
      if (!json.image_base64) {
        throw new Error('PROVIDER_INVALID_RESPONSE');
      }

      return {
        image_base64: json.image_base64,
        mime_type: json.mime_type,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        throw new Error('PROVIDER_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
