import path from 'path';
import { Router } from 'express';
import express from 'express';

export interface LocalUploadStaticConfig {
  urlPrefix?: string;
  baseDir: string;
}

export function createLocalUploadStaticRouter(config: LocalUploadStaticConfig): Router {
  const router = Router();
  const urlPrefix = config.urlPrefix ?? '/uploaded';
  router.use(urlPrefix, express.static(path.resolve(config.baseDir)));
  return router;
}

