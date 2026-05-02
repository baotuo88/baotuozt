import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../auth';
import type { LogsService } from './logs.service';

export function createRequestLoggerMiddleware(logsService: LogsService) {
  return async function requestLogger(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const startedAt = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const userId = req.auth?.sub;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';

      void logsService.writeRequestLog({
        user_id: userId,
        ip,
        method: req.method,
        path: req.originalUrl,
        status_code: res.statusCode,
        duration_ms: durationMs,
      });
    });

    next();
  };
}
