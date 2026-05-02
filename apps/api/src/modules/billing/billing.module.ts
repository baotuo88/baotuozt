import type { RequestHandler, Router } from 'express';
import { createBillingRouter } from './billing.controller';
import { BillingService } from './billing.service';
import type { BillingRepository } from './billing.types';

export interface BillingModuleDeps {
  authMiddleware: RequestHandler;
  billingRepository: BillingRepository;
}

export function createBillingModule(deps: BillingModuleDeps): Router {
  const billingService = new BillingService(deps.billingRepository);
  return createBillingRouter({
    authMiddleware: deps.authMiddleware,
    billingService,
  });
}
