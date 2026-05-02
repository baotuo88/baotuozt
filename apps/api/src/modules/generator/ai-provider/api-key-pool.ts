export type ApiKeyStatus = 'active' | 'inactive' | 'error';

export interface ApiConfigItem {
  id: number;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  status: ApiKeyStatus;
  priority: number;
  used_today?: number;
  daily_budget?: number;
}

export interface ApiConfigRepository {
  listAvailable(model: string): Promise<ApiConfigItem[]>;
  markError(id: number, reason: string): Promise<void>;
  disable(id: number, reason: string): Promise<void>;
}

export class ApiKeyPool {
  private cursorByModel = new Map<string, number>();

  constructor(private readonly repository: ApiConfigRepository) {}

  async getOrderedCandidates(model: string): Promise<ApiConfigItem[]> {
    const all = await this.repository.listAvailable(model);
    const active = all
      .filter((item) => item.status === 'active')
      .filter((item) => {
        if (typeof item.daily_budget !== 'number') {
          return true;
        }
        return (item.used_today ?? 0) < item.daily_budget;
      })
      .sort((a, b) => a.priority - b.priority || a.id - b.id);

    if (active.length === 0) {
      throw new Error('NO_ACTIVE_API_KEY');
    }

    const current = this.cursorByModel.get(model) ?? 0;
    const start = current % active.length;
    const rotated = [...active.slice(start), ...active.slice(0, start)];

    this.cursorByModel.set(model, (start + 1) % active.length);
    return rotated;
  }

  async markFailed(apiConfigId: number, reason: string): Promise<void> {
    await this.repository.markError(apiConfigId, reason);
  }

  async disable(apiConfigId: number, reason: string): Promise<void> {
    await this.repository.disable(apiConfigId, reason);
  }
}
