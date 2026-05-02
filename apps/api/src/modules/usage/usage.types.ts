export interface ModuleUsageItem {
  module: string;
  count: number;
  credits_used: number;
}

export interface UsageOverview {
  total_usage_count: number;
  total_credits_used: number;
  module_usage: ModuleUsageItem[];
}

export interface UsageLogsRepository {
  countUsage(params?: { start_at?: string; end_at?: string }): Promise<number>;
  sumCreditsUsed(params?: { start_at?: string; end_at?: string }): Promise<number>;
  aggregateByModule(params?: { start_at?: string; end_at?: string }): Promise<ModuleUsageItem[]>;
}
