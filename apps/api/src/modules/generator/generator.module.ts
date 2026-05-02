import type { RequestHandler, Router } from 'express';
import type { GenerateImageTaskService } from './generate-image-task';
import {
  createGeneratorRouter,
  type StyleListRepository,
  type TaskQueryRepository,
} from './generator.controller';
import type { RateLimitService } from '../rate-limit';
import type { AbuseService } from '../abuse';
import type { CancelTaskService } from './cancel-task.service';
import type { PromptSafetyService } from '../prompt-safety';

export interface GeneratorModuleDeps {
  authMiddleware: RequestHandler;
  generateImageTaskService: GenerateImageTaskService;
  cancelTaskService?: CancelTaskService;
  taskQueryRepository: TaskQueryRepository;
  styleListRepository?: StyleListRepository;
  rateLimitService?: RateLimitService;
  abuseService?: AbuseService;
  promptSafetyService?: PromptSafetyService;
}

export function createGeneratorModule(deps: GeneratorModuleDeps): Router {
  return createGeneratorRouter({
    authMiddleware: deps.authMiddleware,
    generateImageTaskService: deps.generateImageTaskService,
    cancelTaskService: deps.cancelTaskService,
    taskQueryRepository: deps.taskQueryRepository,
    styleListRepository: deps.styleListRepository,
    rateLimitService: deps.rateLimitService,
    abuseService: deps.abuseService,
    promptSafetyService: deps.promptSafetyService,
  });
}
