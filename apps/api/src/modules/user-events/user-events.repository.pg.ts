import type {
  UserEventRecord,
  UserEventsQuery,
  UserEventsRepository,
  UserEventType,
} from './user-events.types';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

export class UserEventsPgRepository implements UserEventsRepository {
  constructor(private readonly pg: PgClientLike) {}

  async create(record: UserEventRecord): Promise<void> {
    await this.pg.query(
      `INSERT INTO user_events
        (user_id, event_type, event_value, duration_ms, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        record.user_id,
        record.event_type,
        record.event_value ?? null,
        record.duration_ms ?? null,
        JSON.stringify(record.metadata ?? {}),
        record.created_at ?? new Date().toISOString(),
      ],
    );
  }

  async countByType(eventType: UserEventType, query: UserEventsQuery = {}): Promise<number> {
    const params: unknown[] = [eventType];
    const where: string[] = ['event_type = $1'];

    if (typeof query.user_id === 'number') {
      params.push(query.user_id);
      where.push(`user_id = $${params.length}`);
    }
    if (query.start_at) {
      params.push(query.start_at);
      where.push(`created_at >= $${params.length}`);
    }
    if (query.end_at) {
      params.push(query.end_at);
      where.push(`created_at <= $${params.length}`);
    }

    const sql = `SELECT COUNT(*)::int AS count FROM user_events WHERE ${where.join(' AND ')}`;
    const result = await this.pg.query<{ count: number }>(sql, params);
    return result.rows[0]?.count ?? 0;
  }
}
