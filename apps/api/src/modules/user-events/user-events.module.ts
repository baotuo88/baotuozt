import type { RequestHandler, Router } from 'express';
import { createUserEventsRouter } from './user-events.controller';
import type { UserEventsRepository } from './user-events.types';
import { UserEventsService } from './user-events.service';

export interface UserEventsModuleDeps {
  authMiddleware: RequestHandler;
  repository: UserEventsRepository;
}

export function createUserEventsModule(deps: UserEventsModuleDeps): Router {
  const userEventsService = new UserEventsService(deps.repository);
  return createUserEventsRouter({
    authMiddleware: deps.authMiddleware,
    userEventsService,
  });
}
