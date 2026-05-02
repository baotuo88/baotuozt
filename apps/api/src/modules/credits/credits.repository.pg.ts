import crypto from 'crypto';
import type { GenerateMode } from '../style-system';
import type { CreditsRepository } from './credits.service';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

interface DeductRow {
  deduction_id: string;
  balance_after: number;
}

export class CreditsPgRepository implements CreditsRepository {
  constructor(private readonly pg: PgClientLike) {}

  async atomicDeduct(params: {
    user_id: number;
    credits: number;
    mode: GenerateMode;
  }): Promise<{ deduction_id: string; balance_after: number } | null> {
    const deductionId = crypto.randomUUID();

    const result = await this.pg.query<DeductRow>(
      `WITH updated AS (
         UPDATE users
         SET credits = credits - $2
         WHERE id = $1
           AND credits >= $2
         RETURNING id, credits
       ),
       inserted AS (
         INSERT INTO credit_deductions (deduction_id, user_id, credits_used, mode, status, created_at)
         SELECT $4, id, $2, $3, 'deducted', NOW()
         FROM updated
       )
       SELECT $4::text AS deduction_id, credits AS balance_after
       FROM updated
       LIMIT 1`,
      [params.user_id, params.credits, params.mode, deductionId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      deduction_id: row.deduction_id,
      balance_after: row.balance_after,
    };
  }

  async rollbackDeduction(deductionId: string): Promise<void> {
    await this.pg.query(
      `WITH moved AS (
         UPDATE credit_deductions
         SET status = 'rolled_back',
             rolled_back_at = NOW()
         WHERE deduction_id = $1
           AND status = 'deducted'
         RETURNING user_id, credits_used
       )
       UPDATE users AS u
       SET credits = u.credits + moved.credits_used
       FROM moved
       WHERE u.id = moved.user_id`,
      [deductionId],
    );
  }

  async rollbackByTaskId(taskId: number): Promise<void> {
    await this.pg.query(
      `WITH task_ref AS (
         SELECT credit_deduction_id
         FROM tasks
         WHERE id = $1
         LIMIT 1
       ),
       moved AS (
         UPDATE credit_deductions
         SET status = 'rolled_back',
             rolled_back_at = NOW()
         WHERE deduction_id = (SELECT credit_deduction_id FROM task_ref)
           AND status = 'deducted'
         RETURNING user_id, credits_used
       )
       UPDATE users AS u
       SET credits = u.credits + moved.credits_used
       FROM moved
       WHERE u.id = moved.user_id`,
      [taskId],
    );
  }
}

