import type { AdminRepository } from './admin.types';
import type { UsageService } from '../usage';
import type { UserFeatureFlagsPatch } from '../feature-flags';
import type { AdminModelProviderInput } from './admin.types';

export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly usageService?: UsageService,
  ) {}

  async getUsers() {
    return this.repository.listUsers();
  }

  async getApiConfigs() {
    return this.repository.listApiConfigs();
  }

  async setUserStatus(userId: number, status: 'active' | 'disabled' | 'banned') {
    const user = await this.repository.updateUserStatus(userId, status);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    return user;
  }

  async setUserRole(userId: number, role: 'user' | 'admin' | 'operator') {
    const user = await this.repository.updateUserRole(userId, role);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    return user;
  }

  async changeUserCredits(userId: number, delta: number) {
    const user = await this.repository.adjustUserCredits(userId, delta);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    return user;
  }

  async updateUserFeatureFlags(userId: number, featureFlagsPatch: UserFeatureFlagsPatch) {
    const user = await this.repository.updateUserFeatureFlags(userId, featureFlagsPatch);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    return user;
  }

  async getTasks(limit = 100) {
    return this.repository.listTasks(limit);
  }

  async cancelTask(taskId: number) {
    const canceled = await this.repository.cancelTask(taskId);
    if (!canceled) {
      throw new Error('TASK_NOT_FOUND');
    }
    return { canceled: true };
  }

  async createModelProvider(input: AdminModelProviderInput) {
    return this.repository.createModelProvider(input);
  }

  async updateModelProvider(id: number, input: Partial<AdminModelProviderInput>) {
    const row = await this.repository.updateModelProvider(id, input);
    if (!row) {
      throw new Error('MODEL_PROVIDER_NOT_FOUND');
    }
    return row;
  }

  async getStats() {
    const stats = await this.repository.getStats();
    const usage = this.usageService
      ? await this.usageService.getOverview()
      : { total_usage_count: 0, total_credits_used: 0, module_usage: [] };

    return {
      ...stats,
      usage,
    };
  }
}
