import type { ErrorLogRecord, ErrorLogsRepository } from './error-logs.types';

export interface PgClientLike {
  query(sql: string, params: unknown[]): Promise<unknown>;
}

export class ErrorLogsPgRepository implements ErrorLogsRepository {
  constructor(private readonly pg: PgClientLike) {}

  async create(record: ErrorLogRecord): Promise<void> {
    await this.pg.query(
      `INSERT INTO error_logs (
        task_id,
        user_id,
        source,
        code,
        message,
        details,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        record.task_id ?? null,
        record.user_id ?? null,
        record.source,
        record.code,
        record.message,
        JSON.stringify(record.details ?? {}),
        record.created_at ?? new Date().toISOString(),
      ],
    );
  }
}
