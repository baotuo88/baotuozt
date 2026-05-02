import { Worker, type Job } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import {
  IMAGE_TASK_QUEUE_NAME,
} from './image-task.queue';
import type {
  CreditsRollbackGateway,
  ErrorLogWriter,
  FallbackStorage,
  ImageCacheWriter,
  Image2Client,
  ImageTaskJobData,
  Logger,
  S3Storage,
  TaskRepository,
} from './image-task.types';
import { ResilientStorage } from '../reliability';
import type { ImageProcessor } from '../image-optimize';

export interface ImageTaskWorkerDeps {
  redis: RedisOptions;
  concurrency?: number;
  taskRepository: TaskRepository;
  taskStateGateway?: {
    isCanceled(taskId: number): Promise<boolean>;
  };
  image2Client: Image2Client;
  s3Storage: S3Storage;
  imageProcessor: ImageProcessor;
  fallbackStorage?: FallbackStorage;
  imageCacheWriter?: ImageCacheWriter;
  creditsRollbackGateway?: CreditsRollbackGateway;
  errorLogWriter?: ErrorLogWriter;
  logger?: Logger;
  cdnBaseUrl?: string;
  thumbnailWidth?: number;
  stableModelType?: string;
  newModelType?: string;
}

const defaultLogger: Logger = {
  info: (message, meta) => {
    // eslint-disable-next-line no-console
    console.info(message, meta ?? {});
  },
  error: (message, meta) => {
    // eslint-disable-next-line no-console
    console.error(message, meta ?? {});
  },
};

function buildMainKey(taskId: number): string {
  return `generated/${taskId}.webp`;
}

function buildThumbnailKey(taskId: number): string {
  return `generated/thumb/${taskId}.webp`;
}

async function processImageTask(
  job: Job<ImageTaskJobData>,
  deps: Omit<ImageTaskWorkerDeps, 'redis'>,
): Promise<void> {
  const logger = deps.logger ?? defaultLogger;
  const data = job.data;
  const resilientStorage = new ResilientStorage(
    deps.s3Storage,
    deps.fallbackStorage,
    logger,
    deps.errorLogWriter,
    { s3Attempts: 3, s3DelayMs: 500, cdnBaseUrl: deps.cdnBaseUrl },
  );

  logger.info('image task picked', {
    task_id: data.task_id,
    attempt: job.attemptsMade + 1,
  });

  const enteredProcessing = await deps.taskRepository.updateStatus(
    data.task_id,
    'processing',
    undefined,
    {
      onlyIfCurrentIn: ['pending', 'processing'],
      skipIfCanceled: true,
    },
  );
  if (!enteredProcessing) {
    logger.info('image task skipped because task is not updatable', {
      task_id: data.task_id,
    });
    return;
  }

  try {
    const movedToProgress50 = await deps.taskRepository.updateStatus(
      data.task_id,
      'processing',
      {
        progress: 50,
      },
      {
        onlyIfCurrentIn: ['processing'],
        skipIfCanceled: true,
      },
    );
    if (!movedToProgress50) {
      logger.info('image task canceled before model request', { task_id: data.task_id });
      return;
    }

    // 1) 获取任务: BullMQ Worker 拉取 job 即完成
    // 2) 调用 image-2
    const modelType = data.use_new_model ? deps.newModelType : deps.stableModelType;
    const generated = await deps.image2Client.generate({
      prompt: data.prompt,
      negative_prompt: data.negative_prompt,
      mode: data.mode,
      model_type: modelType,
      image_url: data.image_url,
      task_id: data.task_id,
      user_id: data.user_id,
    });

    // 3) 图片压缩(webp) + 缩略图生成
    const optimized = await deps.imageProcessor.process({
      buffer: generated.image_buffer,
      source_mime_type: generated.mime_type,
      thumbnail_width: deps.thumbnailWidth ?? 480,
    });

    const movedToProgress80 = await deps.taskRepository.updateStatus(
      data.task_id,
      'processing',
      {
        progress: 80,
      },
      {
        onlyIfCurrentIn: ['processing'],
        skipIfCanceled: true,
      },
    );
    if (!movedToProgress80) {
      logger.info('image task canceled before upload', { task_id: data.task_id });
      return;
    }

    // 4) 上传主图与缩略图
    const [uploadedMain, uploadedThumbnail] = await Promise.all([
      resilientStorage.upload({
        key: buildMainKey(data.task_id),
        body: optimized.main.buffer,
        content_type: optimized.main.content_type,
        task_id: data.task_id,
        user_id: data.user_id,
      }),
      resilientStorage.upload({
        key: buildThumbnailKey(data.task_id),
        body: optimized.thumbnail.buffer,
        content_type: optimized.thumbnail.content_type,
        task_id: data.task_id,
        user_id: data.user_id,
      }),
    ]);

    // 5) 更新任务状态
    const markedDone = await deps.taskRepository.updateStatus(
      data.task_id,
      'done',
      {
        result_url: uploadedMain.url,
        thumbnail_url: uploadedThumbnail.url,
        progress: 100,
        finished_at: new Date().toISOString(),
        storage_provider: uploadedMain.provider,
        format: 'webp',
      },
      {
        onlyIfCurrentIn: ['processing'],
        skipIfCanceled: true,
      },
    );
    if (!markedDone) {
      logger.info('image task canceled before done status update', { task_id: data.task_id });
      return;
    }

    if (deps.imageCacheWriter) {
      await deps.imageCacheWriter.upsert({
        prompt_hash: data.prompt_hash,
        image_url: uploadedMain.url,
      });
    }

    logger.info('image task done', {
      task_id: data.task_id,
      result_url: uploadedMain.url,
      thumbnail_url: uploadedThumbnail.url,
      storage_provider: uploadedMain.provider,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'TASK_CANCELED') {
      logger.info('image task canceled', { task_id: data.task_id });
      return;
    }

    const maxAttempts = (job.opts.attempts as number | undefined) ?? 3;
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isLastAttempt) {
      await deps.taskRepository.updateStatus(
        data.task_id,
        'failed',
        {
          error_message: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          failed_at: new Date().toISOString(),
        },
        {
          onlyIfCurrentIn: ['pending', 'processing'],
          skipIfCanceled: true,
        },
      );
    } else {
      await deps.taskRepository.updateStatus(
        data.task_id,
        'processing',
        {
          error_message: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        },
        {
          onlyIfCurrentIn: ['pending', 'processing'],
          skipIfCanceled: true,
        },
      );
    }

    await deps.errorLogWriter?.write({
      task_id: data.task_id,
      user_id: data.user_id,
      source: 'worker',
      code: 'IMAGE_TASK_FAILED',
      message: error instanceof Error ? error.message : String(error),
      details: {
        attempt: job.attemptsMade + 1,
        max_attempts: maxAttempts,
      },
    });

    if (isLastAttempt && deps.creditsRollbackGateway) {
      await deps.creditsRollbackGateway.rollbackByTaskId(data.task_id);
    }

    logger.error('image task failed', {
      task_id: data.task_id,
      attempt: job.attemptsMade + 1,
      max_attempts: maxAttempts,
      rolled_back: isLastAttempt,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

export function createImageTaskWorker(deps: ImageTaskWorkerDeps): Worker<ImageTaskJobData> {
  const { redis, ...runtimeDeps } = deps;

  return new Worker<ImageTaskJobData>(
    IMAGE_TASK_QUEUE_NAME,
    async (job) => processImageTask(job, runtimeDeps),
    {
      connection: redis,
      concurrency: deps.concurrency ?? 5,
    },
  );
}
