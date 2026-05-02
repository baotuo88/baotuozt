export type CancelableTaskStatus = 'pending' | 'processing' | 'done' | 'failed' | 'canceled';

export interface TaskForCancel {
  id: number;
  user_id: number;
  status: CancelableTaskStatus;
  cancelable: boolean;
  credit_deduction_id?: string | null;
}

export interface TaskCancelRepository {
  findById(taskId: number): Promise<TaskForCancel | null>;
  markCanceled(taskId: number): Promise<void>;
}

export interface CancelQueueGateway {
  cancelQueuedTask(taskId: number): Promise<void>;
}

export interface CreditsRollbackGateway {
  rollbackDeduction(deductionId: string): Promise<void>;
}

export class CancelTaskService {
  constructor(
    private readonly taskRepository: TaskCancelRepository,
    private readonly queueGateway: CancelQueueGateway,
    private readonly creditsGateway: CreditsRollbackGateway,
  ) {}

  async cancelTask(input: { task_id: number; user_id: number }): Promise<{ canceled: boolean }> {
    const task = await this.taskRepository.findById(input.task_id);
    if (!task) {
      throw new Error('TASK_NOT_FOUND');
    }
    if (task.user_id !== input.user_id) {
      throw new Error('FORBIDDEN');
    }

    if (task.status === 'done') {
      throw new Error('TASK_ALREADY_COMPLETED');
    }
    if (task.status === 'failed' || task.status === 'canceled') {
      throw new Error('TASK_NOT_CANCELABLE');
    }
    if (!task.cancelable) {
      throw new Error('TASK_NOT_CANCELABLE');
    }

    // 1) 标记任务取消
    await this.taskRepository.markCanceled(task.id);

    // 2) 停止队列任务（pending 可移除；processing 走 worker 协作取消）
    await this.queueGateway.cancelQueuedTask(task.id);

    // 3) 回滚点数
    if (task.credit_deduction_id) {
      await this.creditsGateway.rollbackDeduction(task.credit_deduction_id);
    }

    return { canceled: true };
  }
}
