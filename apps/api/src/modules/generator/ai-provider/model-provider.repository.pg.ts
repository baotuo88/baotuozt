import type { ModelProvider, ModelProviderRepository } from './model-provider.router';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

export class ModelProviderPgRepository implements ModelProviderRepository {
  constructor(private readonly pg: PgClientLike) {}

  async listByModelType(modelType: string): Promise<ModelProvider[]> {
    const result = await this.pg.query<ModelProvider>(
      `SELECT
         id,
         name,
         base_url,
         api_key,
         model_type,
         priority,
         status
       FROM model_providers
       WHERE model_type = $1`,
      [modelType],
    );

    return result.rows;
  }

  async markError(providerId: number, _reason: string): Promise<void> {
    await this.pg.query(
      `UPDATE model_providers
       SET status = 'error'
       WHERE id = $1`,
      [providerId],
    );
  }

  async disable(providerId: number, _reason: string): Promise<void> {
    await this.pg.query(
      `UPDATE model_providers
       SET status = 'inactive'
       WHERE id = $1`,
      [providerId],
    );
  }
}
