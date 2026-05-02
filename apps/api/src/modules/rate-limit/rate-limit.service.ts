export interface RateLimitConfig {
  perMinute: number;
  perDay: number;
}

export interface RedisRateLimitStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
  incrWithExpire?(key: string, expireSeconds: number): Promise<number>;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'RATE_LIMIT_PER_MINUTE' | 'RATE_LIMIT_PER_DAY';
  retry_after_seconds?: number;
}

function getMinuteBucket(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${y}${m}${d}${h}${mm}`;
}

function getDayBucket(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export class RateLimitService {
  constructor(
    private readonly store: RedisRateLimitStore,
    private readonly config: RateLimitConfig = { perMinute: 5, perDay: 50 },
  ) {}

  async checkGenerateLimit(userId: number): Promise<RateLimitResult> {
    const now = new Date();
    const minuteKey = `rate:generate:minute:user:${userId}:${getMinuteBucket(now)}`;
    const dayKey = `rate:generate:day:user:${userId}:${getDayBucket(now)}`;

    const minuteCount = this.store.incrWithExpire
      ? await this.store.incrWithExpire(minuteKey, 60)
      : await this.incrFallback(minuteKey, 60);
    if (minuteCount > this.config.perMinute) {
      const ttl = await this.store.ttl(minuteKey);
      return {
        allowed: false,
        reason: 'RATE_LIMIT_PER_MINUTE',
        retry_after_seconds: Math.max(ttl, 1),
      };
    }

    const dayCount = this.store.incrWithExpire
      ? await this.store.incrWithExpire(dayKey, 24 * 60 * 60)
      : await this.incrFallback(dayKey, 24 * 60 * 60);
    if (dayCount > this.config.perDay) {
      const ttl = await this.store.ttl(dayKey);
      return {
        allowed: false,
        reason: 'RATE_LIMIT_PER_DAY',
        retry_after_seconds: Math.max(ttl, 1),
      };
    }

    return { allowed: true };
  }

  private async incrFallback(key: string, expireSeconds: number): Promise<number> {
    const count = await this.store.incr(key);
    if (count === 1) {
      await this.store.expire(key, expireSeconds);
    }
    return count;
  }
}
