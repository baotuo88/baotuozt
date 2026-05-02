import type { UserStatusGateway } from './abuse.service';

export interface PgClientLike {
  query(sql: string, params: unknown[]): Promise<unknown>;
}

export class UserStatusPgGateway implements UserStatusGateway {
  constructor(private readonly pg: PgClientLike) {}

  async setBanned(userId: number, _reason: string): Promise<void> {
    await this.pg.query(
      `UPDATE users
       SET status = 'banned'
       WHERE id = $1`,
      [userId],
    );
  }
}
