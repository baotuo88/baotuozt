import type { Redis } from 'ioredis';
import type { AbuseRedisStore } from './abuse.service';

export class AbuseRedisStoreAdapter implements AbuseRedisStore {
  constructor(private readonly redis: Redis) {}

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

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }
}
