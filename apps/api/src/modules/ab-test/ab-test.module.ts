import type { RequestHandler, Router } from 'express';
import { createAbTestRouter } from './ab-test.controller';
import { AbTestService } from './ab-test.service';
import type { AbTestRepository, GenerateGateway } from './ab-test.types';

export interface AbTestModuleDeps {
  authMiddleware: RequestHandler;
  repository: AbTestRepository;
  generateGateway: GenerateGateway;
}

export function createAbTestModule(deps: AbTestModuleDeps): Router {
  const abTestService = new AbTestService(deps.repository, deps.generateGateway);
  return createAbTestRouter({
    authMiddleware: deps.authMiddleware,
    abTestService,
  });
}
