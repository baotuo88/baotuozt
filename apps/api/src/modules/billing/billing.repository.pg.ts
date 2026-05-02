import type { BillingRepository, OrderEntity } from './billing.types';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

interface OrderRow {
  id: number;
  order_no: string;
  user_id: number;
  credits: number;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  created_at: string;
  paid_at?: string | null;
}

function toOrderEntity(row: OrderRow): OrderEntity {
  return {
    id: row.id,
    order_no: row.order_no,
    user_id: row.user_id,
    credits: row.credits,
    amount: Number(row.amount),
    status: row.status,
    created_at: row.created_at,
    paid_at: row.paid_at ?? null,
  };
}

export class BillingPgRepository implements BillingRepository {
  constructor(private readonly pg: PgClientLike) {}

  async createOrder(input: {
    order_no: string;
    user_id: number;
    credits: number;
    amount: number;
    status: 'pending';
  }): Promise<OrderEntity> {
    const result = await this.pg.query<OrderRow>(
      `INSERT INTO billing_orders (order_no, user_id, credits, amount, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, order_no, user_id, credits, amount, status, created_at, paid_at`,
      [input.order_no, input.user_id, input.credits, input.amount, input.status],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('ORDER_CREATE_FAILED');
    }
    return toOrderEntity(row);
  }

  async findOrderByNo(orderNo: string): Promise<OrderEntity | null> {
    const result = await this.pg.query<OrderRow>(
      `SELECT id, order_no, user_id, credits, amount, status, created_at, paid_at
       FROM billing_orders
       WHERE order_no = $1
       LIMIT 1`,
      [orderNo],
    );
    const row = result.rows[0];
    return row ? toOrderEntity(row) : null;
  }

  async finalizeOrderPaymentAtomic(params: {
    order_id: number;
    user_id: number;
    credits: number;
    order_no: string;
  }): Promise<void> {
    await this.pg.query(
      `WITH paid AS (
         UPDATE billing_orders
         SET status = 'paid',
             paid_at = NOW()
         WHERE id = $1
           AND user_id = $2
           AND order_no = $3
           AND status = 'pending'
         RETURNING user_id
       )
       UPDATE users AS u
       SET credits = u.credits + $4
       WHERE u.id = (SELECT user_id FROM paid LIMIT 1)`,
      [params.order_id, params.user_id, params.order_no, params.credits],
    );
  }

  async listOrdersByUser(userId: number): Promise<OrderEntity[]> {
    const result = await this.pg.query<OrderRow>(
      `SELECT id, order_no, user_id, credits, amount, status, created_at, paid_at
       FROM billing_orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(toOrderEntity);
  }
}

