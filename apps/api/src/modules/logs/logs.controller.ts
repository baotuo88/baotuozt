import { Router, type RequestHandler, type Response } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { LogsService } from './logs.service';

function parseFilter(req: AuthenticatedRequest): {
  start_at?: string;
  end_at?: string;
  user_id?: number;
  limit?: number;
} {
  const startAt = typeof req.query.start_at === 'string' ? req.query.start_at : undefined;
  const endAt = typeof req.query.end_at === 'string' ? req.query.end_at : undefined;
  const userId = typeof req.query.user_id === 'string' ? Number(req.query.user_id) : undefined;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

  return {
    start_at: startAt,
    end_at: endAt,
    user_id: Number.isInteger(userId) ? userId : undefined,
    limit: Number.isInteger(limit) ? limit : undefined,
  };
}

function createRequireAdmin(authMiddleware: RequestHandler): RequestHandler {
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

export function createLogsRouter(params: {
  authMiddleware: RequestHandler;
  logsService: LogsService;
}): Router {
  const router = Router();
  const requireAdmin = createRequireAdmin(params.authMiddleware);

  router.get('/logs/requests', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const rows = await params.logsService.getRequestLogs(parseFilter(req));
    res.status(200).json(rows);
  });

  router.get('/logs/errors', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const rows = await params.logsService.getErrorLogs(parseFilter(req));
    res.status(200).json(rows);
  });

  router.get('/logs/api-calls', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const rows = await params.logsService.getApiCallLogs(parseFilter(req));
    res.status(200).json(rows);
  });

  return router;
}
