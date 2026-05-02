import type { AuthUserRepository, UserEntity, UserRole, UserStatus } from './auth.types';
import type { UserFeatureFlags } from '../feature-flags';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

interface UserRow {
  id: number;
  email: string;
  password: string;
  credits: number;
  role: UserRole;
  status: UserStatus;
  feature_flags: unknown;
  created_at: string;
}

function toUserEntity(row: UserRow): UserEntity {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    credits: row.credits,
    role: row.role,
    status: row.status,
    feature_flags: row.feature_flags,
    created_at: row.created_at,
  };
}

export class AuthUserPgRepository implements AuthUserRepository {
  constructor(private readonly pg: PgClientLike) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const result = await this.pg.query<UserRow>(
      `SELECT id, email, password, credits, role, status, feature_flags, created_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email],
    );
    const row = result.rows[0];
    return row ? toUserEntity(row) : null;
  }

  async findById(id: number): Promise<UserEntity | null> {
    const result = await this.pg.query<UserRow>(
      `SELECT id, email, password, credits, role, status, feature_flags, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? toUserEntity(row) : null;
  }

  async create(data: {
    email: string;
    password: string;
    role: UserRole;
    status: UserStatus;
    credits: number;
    feature_flags: UserFeatureFlags;
  }): Promise<UserEntity> {
    const result = await this.pg.query<UserRow>(
      `INSERT INTO users (email, password, role, status, credits, feature_flags)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, email, password, credits, role, status, feature_flags, created_at`,
      [
        data.email,
        data.password,
        data.role,
        data.status,
        data.credits,
        JSON.stringify(data.feature_flags),
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('USER_CREATE_FAILED');
    }
    return toUserEntity(row);
  }
}

