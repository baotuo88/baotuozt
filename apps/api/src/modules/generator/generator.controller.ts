import { Router, type RequestHandler, type Response } from 'express';
import type { AuthenticatedRequest } from '../auth';
import type { GenerateMode } from '../style-system';
import type { GenerateImageTaskService } from './generate-image-task';
import type { CancelTaskService } from './cancel-task.service';
import type { EcommerceMode } from '../ecommerce';
import type { RateLimitService } from '../rate-limit';
import type { AbuseService } from '../abuse';
import type { PromptSafetyService } from '../prompt-safety';

export interface TaskView {
  id: number;
  user_id: number;
  mode: GenerateMode;
  style_version?: number;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'canceled';
  progress?: number;
  cancelable?: boolean;
  result_url?: string | null;
  created_at?: string;
}

export interface TaskQueryRepository {
  findById(taskId: number): Promise<TaskView | null>;
}

export interface StyleListItem {
  id: number;
  name: string;
  mode: GenerateMode;
  version: number;
}

export interface StyleListRepository {
  listByMode(mode?: GenerateMode): Promise<StyleListItem[]>;
}

function isGenerateMode(value: string): value is GenerateMode {
  return value === 'ecommerce' || value === 'social' || value === 'portrait' || value === 'general';
}

function isEcommerceMode(value: string): value is EcommerceMode {
  return value === 'main' || value === 'detail' || value === 'scene';
}

function mapError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';

  switch (message) {
    case 'INVALID_MODE':
    case 'INVALID_STYLE_ID':
    case 'INVALID_TASK_ID':
      return { status: 400, message };
    case 'PROMPT_POLICY_VIOLATION':
      return { status: 400, message };
    case 'TASK_ALREADY_COMPLETED':
      return { status: 409, message };
    case 'TASK_NOT_CANCELABLE':
      return { status: 400, message };
    case 'TASK_NOT_FOUND':
      return { status: 404, message };
    case 'FORBIDDEN':
      return { status: 403, message };
    case 'RATE_LIMIT_PER_MINUTE':
    case 'RATE_LIMIT_PER_DAY':
      return { status: 429, message };
    case 'ABUSE_FREQUENCY_BANNED':
      return { status: 403, message };
    case 'INSUFFICIENT_CREDITS':
      return { status: 402, message };
    case 'USER_NOT_FOUND':
      return { status: 404, message };
    case 'USER_NOT_ACTIVE':
      return { status: 403, message };
    case 'STYLE_NOT_FOUND':
      return { status: 404, message };
    default:
      return { status: 500, message: 'INTERNAL_ERROR' };
  }
}

export function createGeneratorRouter(params: {
  authMiddleware: RequestHandler;
  generateImageTaskService: GenerateImageTaskService;
  cancelTaskService?: CancelTaskService;
  taskQueryRepository: TaskQueryRepository;
  styleListRepository?: StyleListRepository;
  rateLimitService?: RateLimitService;
  abuseService?: AbuseService;
  promptSafetyService?: PromptSafetyService;
}): Router {
  const router = Router();

  router.get('/styles', async (req, res: Response) => {
    try {
      if (!params.styleListRepository) {
        res.status(200).json([]);
        return;
      }

      const modeRaw = typeof req.query.mode === 'string' ? req.query.mode : '';
      if (modeRaw && !isGenerateMode(modeRaw)) {
        throw new Error('INVALID_MODE');
      }

      const styles = await params.styleListRepository.listByMode(modeRaw ? (modeRaw as GenerateMode) : undefined);
      res.status(200).json(styles);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.post('/generate', params.authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ message: 'UNAUTHORIZED' });
        return;
      }

      const modeRaw = String(req.body?.mode ?? '');
      if (!isGenerateMode(modeRaw)) {
        throw new Error('INVALID_MODE');
      }

      const styleId = Number(req.body?.style_id);
      if (!Number.isInteger(styleId) || styleId <= 0) {
        throw new Error('INVALID_STYLE_ID');
      }

      const userInput = req.body?.user_input ? String(req.body.user_input) : null;
      if (params.promptSafetyService) {
        const safety = await params.promptSafetyService.check(userInput);
        if (!safety.allowed) {
          res.status(400).json({
            message: 'PROMPT_POLICY_VIOLATION',
            detail: safety.message,
            category: safety.category,
          });
          return;
        }
      }

      if (params.abuseService) {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const abuseDecision = await params.abuseService.detectAndBanAbuse({ userId, ip });
        if (!abuseDecision.allowed) {
          res.setHeader('Retry-After', String(abuseDecision.retry_after_seconds ?? 300));
          throw new Error(abuseDecision.reason ?? 'ABUSE_FREQUENCY_BANNED');
        }
      }

      if (params.rateLimitService) {
        const limit = await params.rateLimitService.checkGenerateLimit(userId);
        if (!limit.allowed) {
          res.setHeader('Retry-After', String(limit.retry_after_seconds ?? 60));
          throw new Error(limit.reason ?? 'RATE_LIMIT_PER_MINUTE');
        }
      }

      const ecommerceModeRaw = req.body?.ecommerce_mode;
      const ecommerce_mode =
        typeof ecommerceModeRaw === 'string' && isEcommerceMode(ecommerceModeRaw)
          ? ecommerceModeRaw
          : undefined;

      const result = await params.generateImageTaskService.generateImageTask({
        user_id: userId,
        mode: modeRaw,
        style_id: styleId,
        image_url: req.body?.image_url ? String(req.body.image_url) : null,
        user_input: userInput,
        ecommerce_mode,
      });

      res.status(200).json(result);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.get('/task/:id', params.authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ message: 'UNAUTHORIZED' });
        return;
      }

      const taskId = Number(req.params.id);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        throw new Error('INVALID_TASK_ID');
      }

      const task = await params.taskQueryRepository.findById(taskId);
      if (!task) {
        res.status(404).json({ message: 'TASK_NOT_FOUND' });
        return;
      }

      if (task.user_id !== userId) {
        res.status(403).json({ message: 'FORBIDDEN' });
        return;
      }

      res.status(200).json(task);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.post('/task/:id/cancel', params.authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!params.cancelTaskService) {
        res.status(500).json({ message: 'CANCEL_SERVICE_NOT_CONFIGURED' });
        return;
      }

      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ message: 'UNAUTHORIZED' });
        return;
      }

      const taskId = Number(req.params.id);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        throw new Error('INVALID_TASK_ID');
      }

      const result = await params.cancelTaskService.cancelTask({
        task_id: taskId,
        user_id: userId,
      });

      res.status(200).json(result);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  return router;
}
