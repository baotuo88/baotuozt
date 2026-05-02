import {
  type GenerateMode,
  type StyleConfig,
  generatePrompt,
} from '../style-system';
import type { CreditDeductionReceipt } from '../credits';
import type { ErrorLogWriter } from './queue';
import { buildPromptHash, type ImageCacheService } from '../image-cache';
import {
  type EcommerceMode,
  getEcommerceEnhancers,
} from '../ecommerce';
import { getSocialEnhancers } from '../social';
import { getPortraitEnhancers } from '../portrait';
import { normalizeUserFeatureFlags } from '../feature-flags';

const DEFAULT_STABLE_MODEL_TYPE = 'gpt-image-1';
const DEFAULT_NEW_MODEL_TYPE = 'gpt-image-1';

export interface GenerateImageTaskInput {
  user_id: number;
  mode: GenerateMode;
  style_id: number;
  image_url?: string | null;
  user_input?: string | null;
  ecommerce_mode?: EcommerceMode;
}

export interface GenerateImageTaskOutput {
  task_id: number | null;
  result_url?: string;
  from_cache: boolean;
}

export interface UserSnapshot {
  id: number;
  status: 'active' | 'disabled' | 'banned' | string;
  feature_flags?: unknown;
}

export interface TaskPayload {
  id: number;
  user_id: number;
  mode: GenerateMode;
  style_id: number;
  style_version: number;
  ecommerce_mode?: EcommerceMode;
  credit_deduction_id: string;
  prompt_hash: string;
  image_url: string | null;
  prompt: string;
  negative_prompt: string;
  use_new_model?: boolean;
  status: 'pending';
}

export interface UserGateway {
  findById(userId: number): Promise<UserSnapshot | null>;
}

export interface CreditsGateway {
  deductForGeneration(userId: number, mode: GenerateMode): Promise<CreditDeductionReceipt>;
  rollbackDeduction(deductionId: string): Promise<void>;
}

export interface StyleGateway {
  findById(styleId: number): Promise<StyleConfig | null>;
}

export interface TaskRepository {
  create(data: {
    user_id: number;
    mode: GenerateMode;
    style_id: number;
    style_version: number;
    prompt: string;
    credit_deduction_id: string;
    status: 'pending';
    progress: number;
    image_url: string | null;
  }): Promise<{ id: number }>;
}

export interface QueueGateway {
  enqueueGenerateTask(task: TaskPayload): Promise<void>;
}

export interface GenerateImageTaskDeps {
  userGateway: UserGateway;
  creditsGateway: CreditsGateway;
  styleGateway: StyleGateway;
  taskRepository: TaskRepository;
  queueGateway: QueueGateway;
  imageCacheService?: ImageCacheService;
  errorLogWriter?: ErrorLogWriter;
}

function getScenarioEnhancers(input: GenerateImageTaskInput): string[] {
  if (input.mode === 'ecommerce' && input.ecommerce_mode) {
    return getEcommerceEnhancers(input.ecommerce_mode);
  }
  if (input.mode === 'social') {
    return getSocialEnhancers();
  }
  if (input.mode === 'portrait') {
    return getPortraitEnhancers();
  }
  return [];
}

export class GenerateImageTaskService {
  constructor(private readonly deps: GenerateImageTaskDeps) {}

  async generateImageTask(input: GenerateImageTaskInput): Promise<GenerateImageTaskOutput> {
    // 1) 校验用户
    const user = await this.deps.userGateway.findById(input.user_id);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    if (user.status !== 'active') {
      throw new Error('USER_NOT_ACTIVE');
    }
    const featureFlags = normalizeUserFeatureFlags(user.feature_flags);

    // 2) 扣点（原子）
    const deduction = await this.deps.creditsGateway.deductForGeneration(input.user_id, input.mode);

    try {
      // 3) 生成 prompt
      const style = await this.deps.styleGateway.findById(input.style_id);
      if (!style) {
        throw new Error('STYLE_NOT_FOUND');
      }

      const { prompt, negative_prompt } = generatePrompt({
        user_input: input.user_input,
        style,
        mode: input.mode,
        extra_enhancers: getScenarioEnhancers(input),
      });

      const styleVersion = style.version ?? 1;
      const modelType = featureFlags.enable_new_model ? DEFAULT_NEW_MODEL_TYPE : DEFAULT_STABLE_MODEL_TYPE;
      const promptHashInput = {
        prompt,
        negative_prompt,
        image_url: input.image_url ?? null,
        model_type: modelType,
        mode: input.mode,
        style_version: styleVersion,
      };

      const cacheHit = this.deps.imageCacheService
        ? await this.deps.imageCacheService.getByPrompt(promptHashInput)
        : null;

      if (cacheHit) {
        await this.deps.creditsGateway.rollbackDeduction(deduction.deduction_id);
        return {
          task_id: null,
          result_url: cacheHit.image_url,
          from_cache: true,
        };
      }

      // 4) 创建任务并加入队列
      const task = await this.deps.taskRepository.create({
        user_id: input.user_id,
        mode: input.mode,
        style_id: input.style_id,
        style_version: styleVersion,
        prompt,
        credit_deduction_id: deduction.deduction_id,
        status: 'pending',
        progress: 10,
        image_url: input.image_url ?? null,
      });

      await this.deps.queueGateway.enqueueGenerateTask({
        id: task.id,
        user_id: input.user_id,
        mode: input.mode,
        style_id: input.style_id,
        style_version: styleVersion,
        ecommerce_mode: input.ecommerce_mode,
        credit_deduction_id: deduction.deduction_id,
        prompt_hash: buildPromptHash(promptHashInput),
        image_url: input.image_url ?? null,
        prompt,
        negative_prompt,
        use_new_model: featureFlags.enable_new_model,
        status: 'pending',
      });

      // 5) 返回 task_id
      return { task_id: task.id, from_cache: false };
    } catch (error) {
      await this.deps.errorLogWriter?.write({
        user_id: input.user_id,
        source: 'generate-image-task',
        code: 'GENERATE_TASK_CREATE_FAILED',
        message: error instanceof Error ? error.message : String(error),
        details: {
          mode: input.mode,
          style_id: input.style_id,
        },
      });
      await this.deps.creditsGateway.rollbackDeduction(deduction.deduction_id);
      throw error;
    }
  }
}
