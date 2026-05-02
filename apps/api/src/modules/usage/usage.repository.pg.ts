import type { ModuleUsageItem, UsageLogsRepository } from './usage.types';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

export class UsageLogsPgRepository implements UsageLogsRepository {
  constructor(private readonly pg: PgClientLike) {}

  async countUsage(params: { start_at?: string; end_at?: string } = {}): Promise<number> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.start_at) {
      values.push(params.start_at);
      where.push(`created_at >= $${values.length}`);
    }
    if (params.end_at) {
      values.push(params.end_at);
      where.push(`created_at <= $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM credit_deductions
       ${whereSql}`,
      values,
    );

    return result.rows[0]?.count ?? 0;
  }

  async sumCreditsUsed(params: { start_at?: string; end_at?: string } = {}): Promise<number> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.start_at) {
      values.push(params.start_at);
      where.push(`created_at >= $${values.length}`);
    }
    if (params.end_at) {
      values.push(params.end_at);
      where.push(`created_at <= $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pg.query<{ total: number }>(
      `SELECT COALESCE(SUM(credits_used), 0)::int AS total
       FROM credit_deductions
       ${whereSql}`,
      values,
    );

    return result.rows[0]?.total ?? 0;
  }

  async aggregateByModule(params: { start_at?: string; end_at?: string } = {}): Promise<ModuleUsageItem[]> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.start_at) {
      values.push(params.start_at);
      where.push(`created_at >= $${values.length}`);
    }
    if (params.end_at) {
      values.push(params.end_at);
      where.push(`created_at <= $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pg.query<ModuleUsageItem>(
      `SELECT
         mode AS module,
         COUNT(*)::int AS count,
         COALESCE(SUM(credits_used), 0)::int AS credits_used
       FROM credit_deductions
       ${whereSql}
       GROUP BY mode
       ORDER BY count DESC, credits_used DESC`,
      values,
    );

    return result.rows;
  }
}
