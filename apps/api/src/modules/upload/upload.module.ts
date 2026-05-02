import type { RequestHandler, Router } from 'express';
import { createUploadRouter } from './upload.controller';
import { UploadService } from './upload.service';
import type { UploadStorage } from './upload.types';

export interface UploadModuleDeps {
  authMiddleware: RequestHandler;
  storage: UploadStorage;
}

export function createUploadModule(deps: UploadModuleDeps): Router {
  const uploadService = new UploadService(deps.storage);
  return createUploadRouter({
    authMiddleware: deps.authMiddleware,
    uploadService,
  });
}

