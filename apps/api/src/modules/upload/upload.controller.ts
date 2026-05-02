import { Router, type RequestHandler, type Response } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { UploadService } from './upload.service';

const RAW_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024 + 1024;

function mapError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  switch (message) {
    case 'INVALID_USER_ID':
    case 'INVALID_DATA_URL':
    case 'MIME_TYPE_REQUIRED':
    case 'MIME_TYPE_NOT_ALLOWED':
    case 'MIME_TYPE_MISMATCH':
    case 'INVALID_IMAGE_SIGNATURE':
    case 'EMPTY_FILE_CONTENT':
    case 'INVALID_BASE64_CONTENT':
    case 'FILE_TOO_LARGE':
    case 'INVALID_FILE_CONTENT':
    case 'INVALID_IMAGE_DIMENSIONS':
    case 'IMAGE_DIMENSIONS_TOO_LARGE':
    case 'IMAGE_PIXELS_EXCEEDED':
      return { status: 400, message };
    default:
      return { status: 500, message: 'INTERNAL_ERROR' };
  }
}

export function createUploadRouter(params: {
  authMiddleware: RequestHandler;
  uploadService: UploadService;
}): Router {
  const router = Router();

  const rawBodyParser = (
    req: AuthenticatedRequest,
    _res: Response,
    next: (error?: unknown) => void,
  ): void => {
    if (!req.is('application/octet-stream')) {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    let total = 0;
    let completed = false;
    const state = req as AuthenticatedRequest & { rawBody?: Buffer; rawBodyError?: string };
    const finish = (errorCode?: string): void => {
      if (completed) {
        return;
      }
      completed = true;
      if (errorCode) {
        state.rawBodyError = errorCode;
      } else {
        state.rawBody = Buffer.concat(chunks);
      }
      next();
    };

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > RAW_UPLOAD_LIMIT_BYTES) {
        finish('FILE_TOO_LARGE');
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      finish();
    });
    req.on('error', () => {
      finish('INVALID_FILE_CONTENT');
    });
  };

  router.post('/upload/image', params.authMiddleware, rawBodyParser, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ message: 'UNAUTHORIZED' });
        return;
      }

      const state = req as AuthenticatedRequest & { rawBody?: Buffer; rawBodyError?: string };
      if (state.rawBodyError) {
        throw new Error(state.rawBodyError);
      }
      const rawBody = state.rawBody;
      const mimeFromHeader = req.headers['x-upload-mime-type'];
      const fileNameFromHeader = req.headers['x-upload-file-name'];
      const mimeType =
        typeof mimeFromHeader === 'string'
          ? mimeFromHeader
          : Array.isArray(mimeFromHeader)
            ? mimeFromHeader[0]
            : undefined;
      const fileName =
        typeof fileNameFromHeader === 'string'
          ? fileNameFromHeader
          : Array.isArray(fileNameFromHeader)
            ? fileNameFromHeader[0]
            : undefined;
      let normalizedFileName = fileName;
      if (normalizedFileName) {
        try {
          normalizedFileName = decodeURIComponent(normalizedFileName);
        } catch (_error) {
          normalizedFileName = fileName;
        }
      }

      const result = await params.uploadService.uploadImage({
        user_id: userId,
        file_name: normalizedFileName ?? (req.body?.file_name ? String(req.body.file_name) : undefined),
        mime_type: mimeType ?? (req.body?.mime_type ? String(req.body.mime_type) : undefined),
        content_buffer: rawBody,
        content_base64: req.body?.content_base64 ? String(req.body.content_base64) : undefined,
        data_url: req.body?.data_url ? String(req.body.data_url) : undefined,
      });

      res.status(201).json(result);
    } catch (error) {
      const mapped = mapError(error);
      res.status(mapped.status).json({ message: mapped.message });
    }
  });

  return router;
}
