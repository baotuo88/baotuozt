import type { ApiConfigDataSource } from './api-config.repository';
import type { ApiConfigItem } from './api-key-pool';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

interface ApiConfigRow {
  id: number;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  status: 'active' | 'inactive' | 'error';
  priority: number;
  used_today?: number;
  daily_budget?: number;
}

function toApiConfigItem(row: ApiConfigRow): ApiConfigItem {
  return {
    id: row.id,
    name: row.name,
    base_url: row.base_url,
    api_key: row.api_key,
    model: row.model,
    status: row.status,
    priority: row.priority,
    used_today: row.used_today,
    daily_budget: row.daily_budget,
  };
}

export class ApiConfigPgDataSource implements ApiConfigDataSource {
  constructor(private readonly pg: PgClientLike) {}

  async findByModel(model: string): Promise<ApiConfigItem[]> {
    const result = await this.pg.query<ApiConfigRow>(
      `SELECT id, name, base_url, api_key, model, status, priority, used_today, daily_budget
       FROM api_configs
       WHERE model = $1
       ORDER BY priority ASC, id ASC`,
      [model],
    );
    return result.rows.map(toApiConfigItem);
  }

  async updateStatus(params: {
    id: number;
    status: 'inactive' | 'error';
    last_error: string;
  }): Promise<void> {
    await this.pg.query(
      `UPDATE api_configs
       SET status = $2,
           last_error = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [params.id, params.status, params.last_error],
    );
  }
}

