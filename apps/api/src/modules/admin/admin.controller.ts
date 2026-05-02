import { Router, type RequestHandler, type Response } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { AdminService } from './admin.service';
import { normalizeUserFeatureFlagsPatch } from '../feature-flags';

function createRequireAdminMiddleware(authMiddleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    authMiddleware(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }

      const authReq = req as AuthenticatedRequest;
      if (authReq.auth?.role !== 'admin') {
        res.status(403).json({ message: 'FORBIDDEN' });
        return;
      }

      next();
    });
  };
}

function mapError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  switch (message) {
    case 'INVALID_USER_ID':
    case 'INVALID_FEATURE_FLAGS':
      return { status: 400, message };
    case 'USER_NOT_FOUND':
      return { status: 404, message };
    default:
      return { status: 500, message: 'INTERNAL_ERROR' };
  }
}

export function createAdminRouter(params: {
  authMiddleware: RequestHandler;
  adminService: AdminService;
}): Router {
  const router = Router();
  const requireAdmin = createRequireAdminMiddleware(params.authMiddleware);

  router.get('/admin/users', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await params.adminService.getUsers();
      res.status(200).json(users);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.patch('/admin/users/:id/feature-flags', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('INVALID_USER_ID');
      }

      const patch = normalizeUserFeatureFlagsPatch(req.body);
      if (Object.keys(patch).length === 0) {
        throw new Error('INVALID_FEATURE_FLAGS');
      }

      const user = await params.adminService.updateUserFeatureFlags(userId, patch);
      res.status(200).json(user);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.get('/admin/api-configs', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const apiConfigs = await params.adminService.getApiConfigs();
      res.status(200).json(apiConfigs);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.get('/admin/stats', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await params.adminService.getStats();
      res.status(200).json(stats);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  return router;
}
