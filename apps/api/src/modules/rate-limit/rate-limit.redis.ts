import type { Redis } from 'ioredis';
import type { RedisRateLimitStore } from './rate-limit.service';

export class RedisRateLimitStoreAdapter implements RedisRateLimitStore {
  constructor(private readonly redis: Redis) {}

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.redis.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async incrWithExpire(key: string, expireSeconds: number): Promise<number> {
    const result = await this.redis.eval(
      `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return current
      `,
      1,
      key,
      String(expireSeconds),
    );
    return Number(result);
  }
}
