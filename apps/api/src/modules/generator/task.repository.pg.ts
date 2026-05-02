import type { TaskCancelRepository, TaskForCancel } from './cancel-task.service';
import type { GenerateMode } from '../style-system';
import type { TaskRepository as GenerateTaskRepository } from './generate-image-task';
import type { StyleListItem, StyleListRepository, TaskQueryRepository, TaskView } from './generator.controller';
import type { TaskRepository as WorkerTaskRepository, TaskStatus, TaskUpdateOptions } from './queue';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount?: number }>;
}

interface TaskCreateRow {
  id: number;
}

interface TaskQueryRow {
  id: number;
  user_id: number;
  mode: GenerateMode;
  style_version?: number;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'canceled';
  progress?: number;
  cancelable?: boolean;
  result_url?: string | null;
  created_at?: string;
}

interface TaskCancelRow {
  id: number;
  user_id: number;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'canceled';
  cancelable: boolean;
  credit_deduction_id?: string | null;
}

interface StyleListRow {
  id: number;
  name: string;
  category: string;
  version: number;
}

const UPDATABLE_FIELDS = new Set([
  'progress',
  'result_url',
  'thumbnail_url',
  'finished_at',
  'storage_provider',
  'format',
  'error_message',
  'failed_at',
  'updated_at',
]);

export class GeneratorTaskPgRepository
implements GenerateTaskRepository, TaskQueryRepository, WorkerTaskRepository, StyleListRepository {
  constructor(private readonly pg: PgClientLike) {}

  async create(data: {
    user_id: number;
    mode: GenerateMode;
    style_id: number;
    style_version: number;
    prompt: string;
    credit_deduction_id: string;
    status: 'pending';
    progress: number;
    image_url: string | null;
  }): Promise<{ id: number }> {
    const result = await this.pg.query<TaskCreateRow>(
      `INSERT INTO tasks (
        user_id,
        mode,
        style_id,
        style_version,
        prompt,
        credit_deduction_id,
        status,
        progress,
        image_url,
        cancelable,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW(), NOW())
      RETURNING id`,
      [
        data.user_id,
        data.mode,
        data.style_id,
        data.style_version,
        data.prompt,
        data.credit_deduction_id,
        data.status,
        data.progress,
        data.image_url,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('TASK_CREATE_FAILED');
    }
    return { id: row.id };
  }

  async findById(taskId: number): Promise<TaskView | null> {
    const result = await this.pg.query<TaskQueryRow>(
      `SELECT
         id,
         user_id,
         mode,
         style_version,
         status,
         progress,
         cancelable,
         result_url,
         created_at
       FROM tasks
       WHERE id = $1
       LIMIT 1`,
      [taskId],
    );

    const row = result.rows[0];
    return row ?? null;
  }

  async findByIdForCancel(taskId: number): Promise<TaskForCancel | null> {
    const result = await this.pg.query<TaskCancelRow>(
      `SELECT id, user_id, status, cancelable, credit_deduction_id
       FROM tasks
       WHERE id = $1
       LIMIT 1`,
      [taskId],
    );
    const row = result.rows[0];
    return row ?? null;
  }

  async markCanceled(taskId: number): Promise<void> {
    await this.pg.query(
      `UPDATE tasks
       SET status = 'canceled',
           cancelable = FALSE,
           canceled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [taskId],
    );
  }

  async updateStatus(
    taskId: number,
    status: TaskStatus,
    patch?: Record<string, unknown>,
    options?: TaskUpdateOptions,
  ): Promise<boolean> {
    const sets: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [taskId, status];
    let paramIndex = params.length;
    const whereClauses = ['id = $1'];

    if (patch) {
      for (const [key, value] of Object.entries(patch)) {
        if (!UPDATABLE_FIELDS.has(key)) {
          continue;
        }
        paramIndex += 1;
        sets.push(`${key} = $${paramIndex}`);
        params.push(value);
      }
    }

    if (status === 'done' || status === 'failed') {
      sets.push('cancelable = FALSE');
    }

    if (options?.skipIfCanceled) {
      whereClauses.push(`status != 'canceled'`);
    }
    if (options?.onlyIfCurrentIn?.length) {
      const placeholders: string[] = [];
      for (const candidate of options.onlyIfCurrentIn) {
        paramIndex += 1;
        params.push(candidate);
        placeholders.push(`$${paramIndex}`);
      }
      whereClauses.push(`status IN (${placeholders.join(', ')})`);
    }

    const result = await this.pg.query(
      `UPDATE tasks
       SET ${sets.join(', ')}
       WHERE ${whereClauses.join(' AND ')}`,
      params,
    );

    const rowCount = typeof result.rowCount === 'number' ? result.rowCount : result.rows.length;
    return rowCount > 0;
  }

  async isCanceled(taskId: number): Promise<boolean> {
    const result = await this.pg.query<{ status: string }>(
      `SELECT status
       FROM tasks
       WHERE id = $1
       LIMIT 1`,
      [taskId],
    );
    return result.rows[0]?.status === 'canceled';
  }

  async listByMode(mode?: GenerateMode): Promise<StyleListItem[]> {
    const hasMode = Boolean(mode);
    const result = await this.pg.query<StyleListRow>(
      `SELECT id, name, category, version
       FROM styles
       ${hasMode ? 'WHERE category = $1' : ''}
       ORDER BY id ASC`,
      hasMode ? [mode] : [],
    );

    return result.rows
      .filter((row) => row.category === 'ecommerce' || row.category === 'social' || row.category === 'portrait' || row.category === 'general')
      .map((row) => ({
        id: row.id,
        name: row.name,
        mode: row.category as GenerateMode,
        version: row.version ?? 1,
      }));
  }
}

export class CancelTaskPgRepositoryAdapter implements TaskCancelRepository {
  constructor(private readonly source: GeneratorTaskPgRepository) {}

  async findById(taskId: number): Promise<TaskForCancel | null> {
    return this.source.findByIdForCancel(taskId);
  }

  async markCanceled(taskId: number): Promise<void> {
    await this.source.markCanceled(taskId);
  }
}
