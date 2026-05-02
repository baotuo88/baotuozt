export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderEntity {
  id: number;
  order_no: string;
  user_id: number;
  credits: number;
  amount: number;
  status: OrderStatus;
  created_at: string;
  paid_at?: string | null;
}

export interface CreatePurchaseOrderInput {
  user_id: number;
  credits: number;
  amount: number;
}

export interface PurchaseOrderResult {
  order_id: number;
  order_no: string;
  status: OrderStatus;
}

export interface BillingRepository {
  createOrder(input: {
    order_no: string;
    user_id: number;
    credits: number;
    amount: number;
    status: 'pending';
  }): Promise<OrderEntity>;
  findOrderByNo(orderNo: string): Promise<OrderEntity | null>;
  finalizeOrderPaymentAtomic(params: {
    order_id: number;
    user_id: number;
    credits: number;
    order_no: string;
  }): Promise<void>;
  listOrdersByUser(userId: number): Promise<OrderEntity[]>;
}
