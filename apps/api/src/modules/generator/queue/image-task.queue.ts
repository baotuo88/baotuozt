import { Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import type { ImageTaskJobData } from './image-task.types';

export const IMAGE_TASK_QUEUE_NAME = 'image-task-queue';

export function createImageTaskQueue(redis: RedisOptions): Queue<ImageTaskJobData> {
  return new Queue<ImageTaskJobData>(IMAGE_TASK_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  });
}

export async function enqueueImageTask(
  queue: Queue<ImageTaskJobData>,
  data: ImageTaskJobData,
): Promise<void> {
  await queue.add('generate-image', data, {
    jobId: String(data.task_id),
  });
}

export async function cancelQueuedImageTask(queue: Queue<ImageTaskJobData>, taskId: number): Promise<void> {
  const job = await queue.getJob(String(taskId));
  if (!job) {
    return;
  }

  const state = await job.getState();
  if (state === 'waiting' || state === 'delayed' || state === 'prioritized') {
    await job.remove();
  }
}
