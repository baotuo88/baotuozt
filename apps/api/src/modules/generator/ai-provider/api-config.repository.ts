import type { ApiConfigItem, ApiConfigRepository } from './api-key-pool';

export interface ApiConfigDataSource {
  findByModel(model: string): Promise<ApiConfigItem[]>;
  updateStatus(params: {
    id: number;
    status: 'inactive' | 'error';
    last_error: string;
  }): Promise<void>;
}

export class ApiConfigRepositoryAdapter implements ApiConfigRepository {
  constructor(private readonly source: ApiConfigDataSource) {}

  async listAvailable(model: string): Promise<ApiConfigItem[]> {
    return this.source.findByModel(model);
  }

  async markError(id: number, reason: string): Promise<void> {
    await this.source.updateStatus({ id, status: 'error', last_error: reason });
  }

  async disable(id: number, reason: string): Promise<void> {
    await this.source.updateStatus({ id, status: 'inactive', last_error: reason });
  }
}
