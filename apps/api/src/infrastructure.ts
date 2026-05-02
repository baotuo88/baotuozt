import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Pool, type PoolClient } from 'pg';
import Redis, { type RedisOptions } from 'ioredis';
import type { ApiRuntimeConfig } from './env';

export interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount?: number }>;
}

class PgPoolAdapter implements PgClientLike {
  constructor(private readonly pool: Pool) {}

  async query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount?: number }> {
    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? undefined,
    };
  }
}

export interface UsageLogRow {
  id: number;
  user_id: number;
  module: string;
  credits_used: number;
  created_at: string;
}

class UsagePgAdapter {
  constructor(private readonly pg: PgClientLike) {}

  async countUsage(params: { start_at?: string; end_at?: string } = {}): Promise<number> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.start_at) {
      values.push(params.start_at);
      where.push(`created_at >= $${values.length}`);
    }
    if (params.end_at) {
      values.push(params.end_at);
      where.push(`created_at <= $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pg.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM credit_deductions ${whereSql}`,
      values,
    );
    return result.rows[0]?.count ?? 0;
  }

  async sumCreditsUsed(params: { start_at?: string; end_at?: string } = {}): Promise<number> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.start_at) {
      values.push(params.start_at);
      where.push(`created_at >= $${values.length}`);
    }
    if (params.end_at) {
      values.push(params.end_at);
      where.push(`created_at <= $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pg.query<{ total: number }>(
      `SELECT COALESCE(SUM(credits_used), 0)::int AS total FROM credit_deductions ${whereSql}`,
      values,
    );
    return result.rows[0]?.total ?? 0;
  }

  async aggregateByModule(params: { start_at?: string; end_at?: string } = {}): Promise<Array<{ module: string; count: number; credits_used: number }>> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (params.start_at) {
      values.push(params.start_at);
      where.push(`created_at >= $${values.length}`);
    }
    if (params.end_at) {
      values.push(params.end_at);
      where.push(`created_at <= $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pg.query<{ module: string; count: number; credits_used: number }>(
      `SELECT mode AS module,
              COUNT(*)::int AS count,
              COALESCE(SUM(credits_used), 0)::int AS credits_used
       FROM credit_deductions
       ${whereSql}
       GROUP BY mode
       ORDER BY count DESC, credits_used DESC`,
      values,
    );
    return result.rows;
  }
}

export interface S3StorageLike {
  upload(input: { key: string; body: Buffer; content_type: string }): Promise<{ url: string }>;
}

class AwsS3Storage implements S3StorageLike {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;

  constructor(config: ApiRuntimeConfig) {
    if (!config.s3Bucket) {
      throw new Error('MISSING_ENV:S3_BUCKET');
    }
    if (!config.s3Region) {
      throw new Error('MISSING_ENV:S3_REGION');
    }

    this.bucket = config.s3Bucket;
    this.publicBaseUrl = config.cdnBaseUrl;

    this.s3 = new S3Client({
      region: config.s3Region,
      endpoint: config.s3Endpoint,
      forcePathStyle: config.s3ForcePathStyle,
      credentials: config.s3AccessKeyId && config.s3SecretAccessKey
        ? {
            accessKeyId: config.s3AccessKeyId,
            secretAccessKey: config.s3SecretAccessKey,
          }
        : undefined,
    });
  }

  async upload(input: { key: string; body: Buffer; content_type: string }): Promise<{ url: string }> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.content_type,
      }),
    );

    if (this.publicBaseUrl) {
      const base = this.publicBaseUrl.replace(/\/+$/, '');
      const key = input.key.replace(/^\/+/, '');
      return { url: `${base}/${key}` };
    }

    return {
      url: `https://${this.bucket}.s3.amazonaws.com/${input.key.replace(/^\/+/, '')}`,
    };
  }
}

function parseRedisUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  const tls = url.protocol === 'rediss:';
  const dbRaw = url.pathname.replace(/^\//, '');
  const db = dbRaw ? Number(dbRaw) : 0;

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : (tls ? 6380 : 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number.isInteger(db) ? db : 0,
    tls: tls ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export interface RuntimeInfrastructure {
  pgPool: Pool;
  pg: PgClientLike;
  redisClient: Redis;
  redisOptions: RedisOptions;
  usageRepository: UsagePgAdapter;
  s3Storage: S3StorageLike;
  close(): Promise<void>;
}

function createLocalOnlyS3Like(): S3StorageLike {
  return {
    async upload(): Promise<{ url: string }> {
      throw new Error('S3_DISABLED');
    },
  };
}

export function createInfrastructure(config: ApiRuntimeConfig): RuntimeInfrastructure {
  const pgPool = new Pool({
    connectionString: config.pgUrl,
  });

  const pg = new PgPoolAdapter(pgPool);

  const redisOptions = parseRedisUrl(config.redisUrl);
  const redisClient = new Redis(redisOptions);

  const usageRepository = new UsagePgAdapter(pg);

  const s3Storage = config.s3Enabled ? new AwsS3Storage(config) : createLocalOnlyS3Like();

  return {
    pgPool,
    pg,
    redisClient,
    redisOptions,
    usageRepository,
    s3Storage,
    async close(): Promise<void> {
      await Promise.allSettled([
        redisClient.quit(),
        pgPool.end(),
      ]);
    },
  };
}

export async function withPgTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
