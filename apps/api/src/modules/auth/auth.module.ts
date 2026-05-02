import type { Router } from 'express';
import { AuthService } from './auth.service';
import { createAuthRouter } from './auth.controller';
import type { AuthConfig, AuthUserRepository } from './auth.types';
import type { AbuseService } from '../abuse';

export interface AuthModuleDeps {
  userRepository: AuthUserRepository;
  config: AuthConfig;
  abuseService?: AbuseService;
}

export function createAuthModule(deps: AuthModuleDeps): Router {
  const authService = new AuthService(deps.userRepository, deps.config);
  return createAuthRouter({
    authService,
    abuseService: deps.abuseService,
  });
}
