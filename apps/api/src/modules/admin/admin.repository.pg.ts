import { normalizeUserFeatureFlags } from '../feature-flags';
import type { UserFeatureFlagsPatch } from '../feature-flags';
import type {
  AdminApiConfigItem,
  AdminModelProviderInput,
  AdminRepository,
  AdminStats,
  AdminTaskItem,
  AdminUserItem,
} from './admin.types';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

interface AdminUserRow {
  id: number;
  email: string;
  role: 'user' | 'admin' | 'operator';
  status: 'active' | 'disabled' | 'banned';
  credits: number;
  feature_flags: unknown;
  created_at: string;
}

interface NumberRow {
  value: number;
}

interface AdminTaskRow {
  id: number;
  user_id: number;
  mode: string;
  style_id: number;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'canceled';
  progress: number;
  cancelable: boolean;
  result_url?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

function toAdminUserItem(row: AdminUserRow): AdminUserItem {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    credits: row.credits,
    feature_flags: normalizeUserFeatureFlags(row.feature_flags),
    created_at: row.created_at,
  };
}

async function queryNumber(pg: PgClientLike, sql: string, params: unknown[] = []): Promise<number> {
  const result = await pg.query<NumberRow>(sql, params);
  return Number(result.rows[0]?.value ?? 0);
}

function buildFeatureFlagsMergePatch(patch: UserFeatureFlagsPatch): string {
  const payload: Record<string, boolean> = {};
  if (typeof patch.show_new_feature === 'boolean') {
    payload.show_new_feature = patch.show_new_feature;
  }
  if (typeof patch.enable_new_model === 'boolean') {
    payload.enable_new_model = patch.enable_new_model;
  }
  return JSON.stringify(payload);
}

export class AdminPgRepository implements AdminRepository {
  constructor(private readonly pg: PgClientLike) {}

  async listUsers(): Promise<AdminUserItem[]> {
    const result = await this.pg.query<AdminUserRow>(
      `SELECT id, email, role, status, credits, feature_flags, created_at
       FROM users
       ORDER BY id DESC
       LIMIT 500`,
      [],
    );
    return result.rows.map(toAdminUserItem);
  }

  async updateUserFeatureFlags(
    userId: number,
    featureFlagsPatch: UserFeatureFlagsPatch,
  ): Promise<AdminUserItem | null> {
    const patchJson = buildFeatureFlagsMergePatch(featureFlagsPatch);
    if (patchJson === '{}') {
      const current = await this.pg.query<AdminUserRow>(
        `SELECT id, email, role, status, credits, feature_flags, created_at
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId],
      );
      return current.rows[0] ? toAdminUserItem(current.rows[0]) : null;
    }

    const result = await this.pg.query<AdminUserRow>(
      `UPDATE users
       SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || $2::jsonb
       WHERE id = $1
       RETURNING id, email, role, status, credits, feature_flags, created_at`,
      [userId, patchJson],
    );

    const row = result.rows[0];
    return row ? toAdminUserItem(row) : null;
  }

  async updateUserStatus(
    userId: number,
    status: 'active' | 'disabled' | 'banned',
  ): Promise<AdminUserItem | null> {
    const result = await this.pg.query<AdminUserRow>(
      `UPDATE users
       SET status = $2
       WHERE id = $1
       RETURNING id, email, role, status, credits, feature_flags, created_at`,
      [userId, status],
    );
    const row = result.rows[0];
    return row ? toAdminUserItem(row) : null;
  }

  async updateUserRole(
    userId: number,
    role: 'user' | 'admin' | 'operator',
  ): Promise<AdminUserItem | null> {
    const result = await this.pg.query<AdminUserRow>(
      `UPDATE users
       SET role = $2
       WHERE id = $1
       RETURNING id, email, role, status, credits, feature_flags, created_at`,
      [userId, role],
    );
    const row = result.rows[0];
    return row ? toAdminUserItem(row) : null;
  }

  async adjustUserCredits(userId: number, delta: number): Promise<AdminUserItem | null> {
    const result = await this.pg.query<AdminUserRow>(
      `UPDATE users
       SET credits = GREATEST(0, credits + $2)
       WHERE id = $1
       RETURNING id, email, role, status, credits, feature_flags, created_at`,
      [userId, delta],
    );
    const row = result.rows[0];
    return row ? toAdminUserItem(row) : null;
  }

  async listTasks(limit: number): Promise<AdminTaskItem[]> {
    const normalizedLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 100;
    const result = await this.pg.query<AdminTaskRow>(
      `SELECT id, user_id, mode, style_id, status, progress, cancelable, result_url, error_message, created_at, updated_at
       FROM tasks
       ORDER BY id DESC
       LIMIT $1`,
      [normalizedLimit],
    );
    return result.rows;
  }

  async cancelTask(taskId: number): Promise<boolean> {
    const result = await this.pg.query<{ id: number }>(
      `UPDATE tasks
       SET status = 'canceled',
           cancelable = FALSE,
           canceled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND status IN ('pending', 'processing')
       RETURNING id`,
      [taskId],
    );
    return Boolean(result.rows[0]);
  }

  async listApiConfigs(): Promise<AdminApiConfigItem[]> {
    const result = await this.pg.query<{
      id: number;
      name: string;
      base_url: string;
      model_type: string;
      status: 'active' | 'inactive' | 'error';
      priority: number;
    }>(
      `SELECT id, name, base_url, model_type, status, priority
       FROM model_providers
       ORDER BY priority ASC, id ASC`,
      [],
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      base_url: row.base_url,
      model: row.model_type,
      status: row.status,
      priority: row.priority,
    }));
  }

  async createModelProvider(input: AdminModelProviderInput): Promise<AdminApiConfigItem> {
    const result = await this.pg.query<{
      id: number;
      name: string;
      base_url: string;
      model_type: string;
      status: 'active' | 'inactive' | 'error';
      priority: number;
    }>(
      `INSERT INTO model_providers (name, base_url, api_key, model_type, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, base_url, model_type, status, priority`,
      [input.name, input.base_url, input.api_key, input.model_type, input.priority, input.status],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('MODEL_PROVIDER_CREATE_FAILED');
    }

    return {
      id: row.id,
      name: row.name,
      base_url: row.base_url,
      model: row.model_type,
      status: row.status,
      priority: row.priority,
    };
  }

  async updateModelProvider(
    id: number,
    input: Partial<AdminModelProviderInput>,
  ): Promise<AdminApiConfigItem | null> {
    const sets: string[] = [];
    const params: unknown[] = [id];

    if (typeof input.name === 'string') {
      params.push(input.name);
      sets.push(`name = $${params.length}`);
    }
    if (typeof input.base_url === 'string') {
      params.push(input.base_url);
      sets.push(`base_url = $${params.length}`);
    }
    if (typeof input.api_key === 'string') {
      params.push(input.api_key);
      sets.push(`api_key = $${params.length}`);
    }
    if (typeof input.model_type === 'string') {
      params.push(input.model_type);
      sets.push(`model_type = $${params.length}`);
    }
    if (typeof input.priority === 'number' && Number.isInteger(input.priority)) {
      params.push(input.priority);
      sets.push(`priority = $${params.length}`);
    }
    if (input.status === 'active' || input.status === 'inactive' || input.status === 'error') {
      params.push(input.status);
      sets.push(`status = $${params.length}`);
    }

    if (sets.length === 0) {
      const existing = await this.pg.query<{
        id: number;
        name: string;
        base_url: string;
        model_type: string;
        status: 'active' | 'inactive' | 'error';
        priority: number;
      }>(
        `SELECT id, name, base_url, model_type, status, priority
         FROM model_providers
         WHERE id = $1
         LIMIT 1`,
        [id],
      );
      const row = existing.rows[0];
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        name: row.name,
        base_url: row.base_url,
        model: row.model_type,
        status: row.status,
        priority: row.priority,
      };
    }

    const result = await this.pg.query<{
      id: number;
      name: string;
      base_url: string;
      model_type: string;
      status: 'active' | 'inactive' | 'error';
      priority: number;
    }>(
      `UPDATE model_providers
       SET ${sets.join(', ')}
       WHERE id = $1
       RETURNING id, name, base_url, model_type, status, priority`,
      params,
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      base_url: row.base_url,
      model: row.model_type,
      status: row.status,
      priority: row.priority,
    };
  }

  async getStats(): Promise<AdminStats> {
    let usersTotal = 0;
    let tasksTotal = 0;
    let tasksDone = 0;

    try {
      usersTotal = await queryNumber(this.pg, 'SELECT COUNT(*)::int AS value FROM users');
    } catch (_error) {
      usersTotal = 0;
    }

    try {
      tasksTotal = await queryNumber(this.pg, 'SELECT COUNT(*)::int AS value FROM tasks');
      tasksDone = await queryNumber(
        this.pg,
        `SELECT COUNT(*)::int AS value
         FROM tasks
         WHERE status = 'done'`,
      );
    } catch (_error) {
      tasksTotal = 0;
      tasksDone = 0;
    }

    const tasksSuccessRate = tasksTotal > 0 ? Number((tasksDone / tasksTotal).toFixed(4)) : 0;

    return {
      users_total: usersTotal,
      tasks_total: tasksTotal,
      tasks_success_rate: tasksSuccessRate,
      credits_consumed_today: 0,
      usage: {
        total_usage_count: 0,
        total_credits_used: 0,
        module_usage: [],
      },
      cost_control: {
        daily_budget: 0,
        cost_today: 0,
        remaining_budget: 0,
        alert: false,
      },
    };
  }
}
