import { Router, type RequestHandler, type Response } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { AbTestService } from './ab-test.service';

function mapError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';

  switch (message) {
    case 'AB_TEST_CREATE_FAILED':
      return { status: 500, message };
    case 'INVALID_IMAGE_ID':
      return { status: 400, message };
    default:
      return { status: 500, message: 'INTERNAL_ERROR' };
  }
}

export function createAbTestRouter(params: {
  authMiddleware: RequestHandler;
  abTestService: AbTestService;
}): Router {
  const router = Router();

  router.post('/ab-tests/generate', params.authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ message: 'UNAUTHORIZED' });
        return;
      }

      const result = await params.abTestService.createThreeImages({
        user_id: userId,
        mode: (req.body?.mode ?? 'ecommerce') as 'ecommerce' | 'social' | 'portrait' | 'general',
        style_id: Number(req.body?.style_id),
        image_url: req.body?.image_url ? String(req.body.image_url) : null,
        user_input: req.body?.user_input ? String(req.body.user_input) : null,
      });

      res.status(200).json(result);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.post('/ab-tests/click', async (req, res) => {
    try {
      const imageId = Number(req.body?.image_id);
      await params.abTestService.recordClick(imageId);
      res.status(200).json({ success: true });
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  router.post('/ab-tests/best', async (req, res) => {
    try {
      const imageIds = Array.isArray(req.body?.image_ids)
        ? req.body.image_ids.map((x: unknown) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0)
        : [];

      const best = await params.abTestService.pickBestImage(imageIds);
      if (!best) {
        res.status(404).json({ message: 'BEST_IMAGE_NOT_FOUND' });
        return;
      }

      res.status(200).json(best);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  return router;
}
