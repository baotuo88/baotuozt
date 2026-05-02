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
    case 'INVALID_TASK_ID':
    case 'INVALID_MODEL_PROVIDER_ID':
    case 'INVALID_USER_STATUS':
    case 'INVALID_USER_ROLE':
    case 'INVALID_CREDITS_DELTA':
    case 'INVALID_TASK_LIMIT':
    case 'INVALID_MODEL_PROVIDER_INPUT':
    case 'INVALID_FEATURE_FLAGS':
      return { status: 400, message };
    case 'USER_NOT_FOUND':
    case 'TASK_NOT_FOUND':
    case 'MODEL_PROVIDER_NOT_FOUND':
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

  router.patch('/admin/users/:id/status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('INVALID_USER_ID');
      }
      const status = req.body?.status;
      if (status !== 'active' && status !== 'disabled' && status !== 'banned') {
        throw new Error('INVALID_USER_STATUS');
      }
      const user = await params.adminService.setUserStatus(userId, status);
      res.status(200).json(user);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.patch('/admin/users/:id/role', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('INVALID_USER_ID');
      }
      const role = req.body?.role;
      if (role !== 'user' && role !== 'admin' && role !== 'operator') {
        throw new Error('INVALID_USER_ROLE');
      }
      const user = await params.adminService.setUserRole(userId, role);
      res.status(200).json(user);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.post('/admin/users/:id/credits', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('INVALID_USER_ID');
      }
      const delta = Number(req.body?.delta);
      if (!Number.isInteger(delta) || delta === 0) {
        throw new Error('INVALID_CREDITS_DELTA');
      }
      const user = await params.adminService.changeUserCredits(userId, delta);
      res.status(200).json(user);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.get('/admin/tasks', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
      if (!Number.isInteger(limitRaw) || limitRaw <= 0) {
        throw new Error('INVALID_TASK_LIMIT');
      }
      const rows = await params.adminService.getTasks(limitRaw);
      res.status(200).json(rows);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.post('/admin/tasks/:id/cancel', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        throw new Error('INVALID_TASK_ID');
      }
      const result = await params.adminService.cancelTask(taskId);
      res.status(200).json(result);
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

  router.post('/admin/model-providers', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const base_url = typeof req.body?.base_url === 'string' ? req.body.base_url.trim() : '';
      const api_key = typeof req.body?.api_key === 'string' ? req.body.api_key.trim() : '';
      const model_type = typeof req.body?.model_type === 'string' ? req.body.model_type.trim() : '';
      const priority = Number(req.body?.priority ?? 100);
      const status = req.body?.status;
      if (!name || !base_url || !api_key || !model_type || !Number.isInteger(priority)) {
        throw new Error('INVALID_MODEL_PROVIDER_INPUT');
      }
      if (status !== 'active' && status !== 'inactive' && status !== 'error') {
        throw new Error('INVALID_MODEL_PROVIDER_INPUT');
      }
      const created = await params.adminService.createModelProvider({
        name,
        base_url,
        api_key,
        model_type,
        priority,
        status,
      });
      res.status(201).json(created);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.patch('/admin/model-providers/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error('INVALID_MODEL_PROVIDER_ID');
      }
      const patch: Record<string, unknown> = {};
      if (typeof req.body?.name === 'string') {
        patch.name = req.body.name.trim();
      }
      if (typeof req.body?.base_url === 'string') {
        patch.base_url = req.body.base_url.trim();
      }
      if (typeof req.body?.api_key === 'string') {
        patch.api_key = req.body.api_key.trim();
      }
      if (typeof req.body?.model_type === 'string') {
        patch.model_type = req.body.model_type.trim();
      }
      if (req.body?.priority !== undefined) {
        const priority = Number(req.body.priority);
        if (!Number.isInteger(priority)) {
          throw new Error('INVALID_MODEL_PROVIDER_INPUT');
        }
        patch.priority = priority;
      }
      if (req.body?.status !== undefined) {
        const status = req.body.status;
        if (status !== 'active' && status !== 'inactive' && status !== 'error') {
          throw new Error('INVALID_MODEL_PROVIDER_INPUT');
        }
        patch.status = status;
      }
      const updated = await params.adminService.updateModelProvider(id, patch);
      res.status(200).json(updated);
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
