import type { UsageLogsRepository, UsageOverview } from './usage.types';

export interface UsageStatsQuery {
  start_at?: string;
  end_at?: string;
}

export class UsageService {
  constructor(private readonly repository: UsageLogsRepository) {}

  async getOverview(query: UsageStatsQuery = {}): Promise<UsageOverview> {
    const [totalUsageCount, totalCreditsUsed, moduleUsage] = await Promise.all([
      this.repository.countUsage(query),
      this.repository.sumCreditsUsed(query),
      this.repository.aggregateByModule(query),
    ]);

    return {
      total_usage_count: totalUsageCount,
      total_credits_used: totalCreditsUsed,
      module_usage: moduleUsage,
    };
  }
}
