import { Router, type RequestHandler, type Response } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { UserEventsService } from './user-events.service';
import type { UserEventType } from './user-events.types';

const ALLOWED_EVENT_TYPES: UserEventType[] = [
  'click_generate',
  'select_style',
  'download_image',
  'dwell_time',
];

function isEventType(value: string): value is UserEventType {
  return ALLOWED_EVENT_TYPES.includes(value as UserEventType);
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

export function createUserEventsRouter(params: {
  authMiddleware: RequestHandler;
  userEventsService: UserEventsService;
}): Router {
  const router = Router();
  const requireAdmin = createRequireAdmin(params.authMiddleware);

  router.post('/events/track', params.authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth?.sub;
    if (!userId) {
      res.status(401).json({ message: 'UNAUTHORIZED' });
      return;
    }

    const eventTypeRaw = String(req.body?.event_type ?? '');
    if (!isEventType(eventTypeRaw)) {
      res.status(400).json({ message: 'INVALID_EVENT_TYPE' });
      return;
    }

    await params.userEventsService.track({
      user_id: userId,
      event_type: eventTypeRaw,
      event_value: req.body?.event_value ? String(req.body.event_value) : undefined,
      duration_ms: Number.isFinite(Number(req.body?.duration_ms)) ? Number(req.body.duration_ms) : undefined,
      metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : undefined,
    });

    res.status(200).json({ success: true });
  });

  router.get('/events/conversion', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const userIdRaw = req.query.user_id;
    const startAt = typeof req.query.start_at === 'string' ? req.query.start_at : undefined;
    const endAt = typeof req.query.end_at === 'string' ? req.query.end_at : undefined;
    const userId = typeof userIdRaw === 'string' ? Number(userIdRaw) : undefined;

    const summary = await params.userEventsService.getConversionSummary({
      start_at: startAt,
      end_at: endAt,
      user_id: Number.isInteger(userId) ? userId : undefined,
    });

    res.status(200).json(summary);
  });

  return router;
}
