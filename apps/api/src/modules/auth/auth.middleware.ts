import type { NextFunction, Request, Response } from 'express';
import type { AuthService } from './auth.service';
import type { JwtPayload } from './auth.types';

export interface AuthenticatedRequest extends Request {
  auth?: JwtPayload;
}

function getBearerToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }
  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) {
    return null;
  }
  return token;
}

export function createAuthMiddleware(authService: AuthService) {
  return function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ message: 'UNAUTHORIZED' });
      return;
    }

    try {
      const payload = authService.verifyToken(token);
      req.auth = payload;
      next();
    } catch (_error) {
      res.status(401).json({ message: 'INVALID_TOKEN' });
    }
  };
}
