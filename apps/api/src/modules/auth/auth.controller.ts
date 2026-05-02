import { Router, type Request, type Response } from 'express';
import { AuthService } from './auth.service';
import { createAuthMiddleware, type AuthenticatedRequest } from './auth.middleware';
import type { AbuseService } from '../abuse';

function mapError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';

  switch (message) {
    case 'INVALID_EMAIL':
    case 'PASSWORD_TOO_SHORT':
      return { status: 400, message };
    case 'EMAIL_ALREADY_EXISTS':
      return { status: 409, message };
    case 'REGISTER_IP_LIMIT':
      return { status: 429, message };
    case 'INVALID_CREDENTIALS':
    case 'USER_NOT_ACTIVE':
      return { status: 401, message };
    case 'USER_NOT_FOUND':
      return { status: 404, message };
    default:
      return { status: 500, message: 'INTERNAL_ERROR' };
  }
}

export function createAuthRouter(params: {
  authService: AuthService;
  abuseService?: AbuseService;
}): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(params.authService);

  router.post('/register', async (req: Request, res: Response) => {
    try {
      if (params.abuseService) {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const decision = await params.abuseService.checkRegisterIpLimit(ip);
        if (!decision.allowed) {
          res.setHeader('Retry-After', String(decision.retry_after_seconds ?? 86400));
          throw new Error(decision.reason ?? 'REGISTER_IP_LIMIT');
        }
      }

      const result = await params.authService.register({
        email: String(req.body?.email ?? ''),
        password: String(req.body?.password ?? ''),
      });
      res.status(201).json(result);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.post('/login', async (req: Request, res: Response) => {
    try {
      const result = await params.authService.login({
        email: String(req.body?.email ?? ''),
        password: String(req.body?.password ?? ''),
      });
      res.status(200).json(result);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ message: 'UNAUTHORIZED' });
        return;
      }
      const user = await params.authService.getUserInfo(userId);
      res.status(200).json(user);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  return router;
}
