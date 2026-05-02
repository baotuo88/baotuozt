export interface AbuseConfig {
  registerPerIpPerDay: number;
  abnormalPerMinute: number;
  abnormalPerFiveMinutes: number;
}

export interface AbuseRedisStore {
  incrWithExpire(key: string, expireSeconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

export interface UserStatusGateway {
  setBanned(userId: number, reason: string): Promise<void>;
}

export interface AbuseDecision {
  allowed: boolean;
  reason?: 'REGISTER_IP_LIMIT' | 'ABUSE_FREQUENCY_BANNED';
  retry_after_seconds?: number;
}

function dayBucket(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function minuteBucket(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${y}${m}${d}${h}${mm}`;
}

function fiveMinuteBucket(now: Date): string {
  const baseMinute = Math.floor(now.getUTCMinutes() / 5) * 5;
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(baseMinute).padStart(2, '0');
  return `${y}${m}${d}${h}${mm}`;
}

export class AbuseService {
  constructor(
    private readonly store: AbuseRedisStore,
    private readonly userStatusGateway: UserStatusGateway,
    private readonly config: AbuseConfig = {
      registerPerIpPerDay: 3,
      abnormalPerMinute: 20,
      abnormalPerFiveMinutes: 60,
    },
  ) {}

  async checkRegisterIpLimit(ip: string): Promise<AbuseDecision> {
    const now = new Date();
    const key = `abuse:register:ip:${ip}:${dayBucket(now)}`;
    const count = await this.store.incrWithExpire(key, 24 * 60 * 60);

    if (count > this.config.registerPerIpPerDay) {
      const ttl = await this.store.ttl(key);
      return {
        allowed: false,
        reason: 'REGISTER_IP_LIMIT',
        retry_after_seconds: Math.max(ttl, 1),
      };
    }

    return { allowed: true };
  }

  async detectAndBanAbuse(params: { userId: number; ip: string }): Promise<AbuseDecision> {
    const now = new Date();
    const minuteKey = `abuse:gen:minute:user:${params.userId}:${minuteBucket(now)}`;
    const fiveMinuteKey = `abuse:gen:5m:user:${params.userId}:${fiveMinuteBucket(now)}`;

    const minuteCount = await this.store.incrWithExpire(minuteKey, 60);
    const fiveMinuteCount = await this.store.incrWithExpire(fiveMinuteKey, 5 * 60);

    if (
      minuteCount > this.config.abnormalPerMinute ||
      fiveMinuteCount > this.config.abnormalPerFiveMinutes
    ) {
      await this.userStatusGateway.setBanned(
        params.userId,
        `ABUSE_DETECTED ip=${params.ip} minute=${minuteCount} five_minute=${fiveMinuteCount}`,
      );

      const ttl = await this.store.ttl(fiveMinuteKey);
      return {
        allowed: false,
        reason: 'ABUSE_FREQUENCY_BANNED',
        retry_after_seconds: Math.max(ttl, 1),
      };
    }

    return { allowed: true };
  }
}
