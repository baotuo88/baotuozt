import type { Queue } from 'bullmq';
import type { CancelQueueGateway } from '../cancel-task.service';
import type { QueueGateway } from '../generate-image-task';
import { cancelQueuedImageTask, enqueueImageTask } from './image-task.queue';
import type { ImageTaskJobData } from './image-task.types';
import type { EcommerceMode } from '../../ecommerce';

export class BullMQQueueGateway implements QueueGateway, CancelQueueGateway {
  constructor(private readonly queue: Queue<ImageTaskJobData>) {}

  async enqueueGenerateTask(task: {
    id: number;
    user_id: number;
    mode: ImageTaskJobData['mode'];
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
  }): Promise<void> {
    await enqueueImageTask(this.queue, {
      task_id: task.id,
      user_id: task.user_id,
      mode: task.mode,
      style_id: task.style_id,
      style_version: task.style_version,
      ecommerce_mode: task.ecommerce_mode,
      credit_deduction_id: task.credit_deduction_id,
      prompt_hash: task.prompt_hash,
      image_url: task.image_url,
      prompt: task.prompt,
      negative_prompt: task.negative_prompt,
      use_new_model: task.use_new_model,
    });
  }

  async cancelQueuedTask(taskId: number): Promise<void> {
    await cancelQueuedImageTask(this.queue, taskId);
  }
}
