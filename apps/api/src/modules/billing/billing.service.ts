import {
  type BillingRepository,
  type CreatePurchaseOrderInput,
  type PurchaseOrderResult,
} from './billing.types';

function createOrderNo(): string {
  return `ORD_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export class BillingService {
  constructor(
    private readonly billingRepository: BillingRepository,
  ) {}

  async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderResult> {
    if (!Number.isInteger(input.credits) || input.credits <= 0) {
      throw new Error('INVALID_CREDITS');
    }
    if (input.amount <= 0) {
      throw new Error('INVALID_AMOUNT');
    }

    const orderNo = createOrderNo();
    const order = await this.billingRepository.createOrder({
      order_no: orderNo,
      user_id: input.user_id,
      credits: input.credits,
      amount: input.amount,
      status: 'pending',
    });

    return {
      order_id: order.id,
      order_no: order.order_no,
      status: order.status,
    };
  }

  async payOrder(orderNo: string, userId: number): Promise<void> {
    const order = await this.billingRepository.findOrderByNo(orderNo);
    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }
    if (order.user_id !== userId) {
      throw new Error('ORDER_FORBIDDEN');
    }
    if (order.status === 'paid') {
      return;
    }
    if (order.status !== 'pending') {
      throw new Error('ORDER_STATUS_INVALID');
    }

    // 仓储层必须用数据库事务保证：订单状态更新 + 加点原子一致
    await this.billingRepository.finalizeOrderPaymentAtomic({
      order_id: order.id,
      user_id: order.user_id,
      credits: order.credits,
      order_no: order.order_no,
    });
  }

  async listMyOrders(userId: number) {
    return this.billingRepository.listOrdersByUser(userId);
  }
}
