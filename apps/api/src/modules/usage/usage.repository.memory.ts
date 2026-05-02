import type { ModuleUsageItem, UsageLogsRepository } from './usage.types';

export interface UsageLogRow {
  id: number;
  user_id: number;
  module: string;
  credits_used: number;
  created_at: string;
}

function inRange(row: UsageLogRow, startAt?: string, endAt?: string): boolean {
  const t = new Date(row.created_at).getTime();
  if (startAt && t < new Date(startAt).getTime()) {
    return false;
  }
  if (endAt && t > new Date(endAt).getTime()) {
    return false;
  }
  return true;
}

export class UsageLogsMemoryRepository implements UsageLogsRepository {
  constructor(private readonly rows: UsageLogRow[]) {}

  async countUsage(params: { start_at?: string; end_at?: string } = {}): Promise<number> {
    return this.rows.filter((row) => inRange(row, params.start_at, params.end_at)).length;
  }

  async sumCreditsUsed(params: { start_at?: string; end_at?: string } = {}): Promise<number> {
    return this.rows
      .filter((row) => inRange(row, params.start_at, params.end_at))
      .reduce((sum, row) => sum + row.credits_used, 0);
  }

  async aggregateByModule(params: { start_at?: string; end_at?: string } = {}): Promise<ModuleUsageItem[]> {
    const grouped = new Map<string, { count: number; credits_used: number }>();

    for (const row of this.rows) {
      if (!inRange(row, params.start_at, params.end_at)) {
        continue;
      }

      const current = grouped.get(row.module) ?? { count: 0, credits_used: 0 };
      grouped.set(row.module, {
        count: current.count + 1,
        credits_used: current.credits_used + row.credits_used,
      });
    }

    return [...grouped.entries()]
      .map(([module, value]) => ({
        module,
        count: value.count,
        credits_used: value.credits_used,
      }))
      .sort((a, b) => b.count - a.count || b.credits_used - a.credits_used);
  }
}
