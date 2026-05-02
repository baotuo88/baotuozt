import { Router, type RequestHandler, type Response } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { BillingService } from './billing.service';

function mapError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';

  switch (message) {
    case 'INVALID_CREDITS':
    case 'INVALID_AMOUNT':
      return { status: 400, message };
    case 'ORDER_NOT_FOUND':
      return { status: 404, message };
    case 'ORDER_FORBIDDEN':
      return { status: 403, message };
    case 'ORDER_STATUS_INVALID':
      return { status: 409, message };
    default:
      return { status: 500, message: 'INTERNAL_ERROR' };
  }
}

export function createBillingRouter(params: {
  authMiddleware: RequestHandler;
  billingService: BillingService;
}): Router {
  const router = Router();

  router.post('/billing/purchase', params.authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ message: 'UNAUTHORIZED' });
        return;
      }

      const result = await params.billingService.createPurchaseOrder({
        user_id: userId,
        credits: Number(req.body?.credits),
        amount: Number(req.body?.amount),
      });

      res.status(201).json(result);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.post('/billing/pay/:orderNo', params.authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ message: 'UNAUTHORIZED' });
        return;
      }
      await params.billingService.payOrder(String(req.params.orderNo), userId);
      res.status(200).json({ success: true });
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.get('/billing/orders', params.authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ message: 'UNAUTHORIZED' });
        return;
      }

      const orders = await params.billingService.listMyOrders(userId);
      res.status(200).json(orders);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  return router;
}
