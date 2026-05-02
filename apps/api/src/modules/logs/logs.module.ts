import type { RequestHandler, Router } from 'express';
import { createLogsRouter } from './logs.controller';
import { LogsService } from './logs.service';
import type { LogsRepository } from './logs.types';

export interface LogsModuleDeps {
  authMiddleware: RequestHandler;
  repository: LogsRepository;
}

export function createLogsModule(deps: LogsModuleDeps): Router {
  const logsService = new LogsService(deps.repository);
  return createLogsRouter({
    authMiddleware: deps.authMiddleware,
    logsService,
  });
}
