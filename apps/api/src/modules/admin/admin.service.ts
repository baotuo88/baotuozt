import type { AdminRepository } from './admin.types';
import type { UsageService } from '../usage';
import type { UserFeatureFlagsPatch } from '../feature-flags';

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

  async updateUserFeatureFlags(userId: number, featureFlagsPatch: UserFeatureFlagsPatch) {
    const user = await this.repository.updateUserFeatureFlags(userId, featureFlagsPatch);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
    return user;
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
