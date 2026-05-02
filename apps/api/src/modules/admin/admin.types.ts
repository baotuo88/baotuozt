import type { UserFeatureFlags, UserFeatureFlagsPatch } from '../feature-flags';

export interface AdminUserItem {
  id: number;
  email: string;
  role: 'user' | 'admin' | 'operator';
  status: 'active' | 'disabled' | 'banned';
  credits: number;
  feature_flags: UserFeatureFlags;
  created_at: string;
}

export interface AdminApiConfigItem {
  id: number;
  name: string;
  base_url: string;
  model: string;
  status: 'active' | 'inactive' | 'error';
  priority: number;
  used_today?: number;
  daily_budget?: number;
}

export interface AdminStats {
  users_total: number;
  tasks_total: number;
  tasks_success_rate: number;
  credits_consumed_today: number;
  usage: {
    total_usage_count: number;
    total_credits_used: number;
    module_usage: Array<{
      module: string;
      count: number;
      credits_used: number;
    }>;
  };
  cost_control: {
    daily_budget: number;
    cost_today: number;
    remaining_budget: number;
    alert: boolean;
  };
}

export interface AdminRepository {
  listUsers(): Promise<AdminUserItem[]>;
  updateUserFeatureFlags(userId: number, featureFlagsPatch: UserFeatureFlagsPatch): Promise<AdminUserItem | null>;
  listApiConfigs(): Promise<AdminApiConfigItem[]>;
  getStats(): Promise<AdminStats>;
}
