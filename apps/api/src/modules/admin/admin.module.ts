import type { RequestHandler, Router } from 'express';
import { createAdminRouter } from './admin.controller';
import { AdminService } from './admin.service';
import type { AdminRepository } from './admin.types';
import type { UsageService } from '../usage';

export interface AdminModuleDeps {
  authMiddleware: RequestHandler;
  repository: AdminRepository;
  usageService?: UsageService;
}

export function createAdminModule(deps: AdminModuleDeps): Router {
  const adminService = new AdminService(deps.repository, deps.usageService);
  return createAdminRouter({
    authMiddleware: deps.authMiddleware,
    adminService,
  });
}
