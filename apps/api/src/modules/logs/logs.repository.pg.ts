import type {
  ApiCallLogRecord,
  ApiCallLogView,
  ErrorLogView,
  LogQueryFilter,
  LogsRepository,
  RequestLogRecord,
  RequestLogView,
} from './logs.types';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

function normalizeLimit(limit?: number): number {
  if (!limit || limit <= 0) {
    return 100;
  }
  return Math.min(limit, 500);
}

export class LogsPgRepository implements LogsRepository {
  constructor(private readonly pg: PgClientLike) {}

  async createRequestLog(record: RequestLogRecord): Promise<void> {
    await this.pg.query(
      `INSERT INTO request_logs
        (user_id, ip, method, path, status_code, duration_ms, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.user_id ?? null,
        record.ip,
        record.method,
        record.path,
        record.status_code,
        record.duration_ms,
        record.created_at ?? new Date().toISOString(),
      ],
    );
  }

  async createApiCallLog(record: ApiCallLogRecord): Promise<void> {
    await this.pg.query(
      `INSERT INTO api_call_logs
        (user_id, task_id, provider, endpoint, status, latency_ms, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.user_id ?? null,
        record.task_id ?? null,
        record.provider,
        record.endpoint,
        record.status,
        record.latency_ms,
        record.error_message ?? null,
        record.created_at ?? new Date().toISOString(),
      ],
    );
  }

  async queryRequestLogs(filter: LogQueryFilter): Promise<RequestLogView[]> {
    const limit = normalizeLimit(filter.limit);
    return this.queryByFilter<RequestLogView>(
      `SELECT id, user_id, ip, method, path, status_code, duration_ms, created_at
       FROM request_logs`,
      filter,
      limit,
    );
  }

  async queryErrorLogs(filter: LogQueryFilter): Promise<ErrorLogView[]> {
    const limit = normalizeLimit(filter.limit);
    return this.queryByFilter<ErrorLogView>(
      `SELECT id, task_id, user_id, source, code, message, details, created_at
       FROM error_logs`,
      filter,
      limit,
    );
  }

  async queryApiCallLogs(filter: LogQueryFilter): Promise<ApiCallLogView[]> {
    const limit = normalizeLimit(filter.limit);
    return this.queryByFilter<ApiCallLogView>(
      `SELECT id, user_id, task_id, provider, endpoint, status, latency_ms, error_message, created_at
       FROM api_call_logs`,
      filter,
      limit,
    );
  }

  private async queryByFilter<T>(baseSql: string, filter: LogQueryFilter, limit: number): Promise<T[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (typeof filter.user_id === 'number') {
      params.push(filter.user_id);
      where.push(`user_id = $${params.length}`);
    }
    if (filter.start_at) {
      params.push(filter.start_at);
      where.push(`created_at >= $${params.length}`);
    }
    if (filter.end_at) {
      params.push(filter.end_at);
      where.push(`created_at <= $${params.length}`);
    }

    const whereSql = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
    params.push(limit);

    const sql = `${baseSql}${whereSql} ORDER BY created_at DESC LIMIT $${params.length}`;
    const result = await this.pg.query<T>(sql, params);
    return result.rows;
  }
}
