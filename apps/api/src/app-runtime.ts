import { Router as ExpressRouter, type RequestHandler, type Router } from 'express';
import { Pool, types as pgTypes } from 'pg';
import Redis from 'ioredis';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import {
  createApiApp,
} from './create-api-app';
import { startApiServer } from './start-api-server';
import {
  createAuthMiddleware,
  createAuthModule,
  AuthService,
  AuthUserPgRepository,
} from './modules/auth';
import {
  createGeneratorModule,
  GenerateImageTaskService,
  GeneratorTaskPgRepository,
  UserPgGateway,
  StylePgGateway,
  createImageTaskQueue,
  BullMQQueueGateway,
  CancelTaskService,
  CancelTaskPgRepositoryAdapter,
  MultiModelProviderRouter,
  ModelProviderPgRepository,
  Image2FailoverClient,
  ApiKeyPool,
  ApiConfigRepositoryAdapter,
  ApiConfigPgDataSource,
} from './modules/generator';
import {
  CreditsPgRepository,
  CreditsService,
} from './modules/credits';
import {
  createUploadModule,
  createLocalUploadStaticRouter,
  LocalUploadStorage,
} from './modules/upload';
import {
  createLogsModule,
  LogsPgRepository,
  LogsService,
  createRequestLoggerMiddleware,
} from './modules/logs';
import {
  createUserEventsModule,
  UserEventsPgRepository,
} from './modules/user-events';
import {
  createBillingModule,
  BillingPgRepository,
} from './modules/billing';
import {
  createAdminModule,
  AdminPgRepository,
} from './modules/admin';
import {
  createAbTestModule,
  AbTestPgRepository,
} from './modules/ab-test';
import {
  RedisRateLimitStoreAdapter,
  RateLimitService,
} from './modules/rate-limit';
import {
  AbuseRedisStoreAdapter,
  AbuseService,
  UserStatusPgGateway,
} from './modules/abuse';
import {
  PromptSafetyService,
  PromptWordBankPgRepository,
} from './modules/prompt-safety';
import {
  ErrorLogsPgRepository,
  ErrorLogsService,
} from './modules/error-logs';
import {
  ImageCachePgRepository,
  ImageCacheService,
} from './modules/image-cache';
import {
  UsageLogsPgRepository,
  UsageService,
} from './modules/usage';
import {
  SharpImageProcessor,
  LocalFallbackStorage,
} from './modules/generator';
import { loadApiRuntimeConfig } from './env';
import { AwsS3Storage } from './modules/storage';

interface PgClientLike {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount?: number }>;
}

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`MISSING_ENV:${name}`);
  }
  return value.trim();
}

function parseRedisOptions(redisUrl: string) {
  const url = new URL(redisUrl);
  const tlsEnabled = url.protocol === 'rediss:';
  const db = Number(url.pathname.replace(/^\//, '') || '0');

  return {
    host: url.hostname,
    port: Number(url.port || (tlsEnabled ? 6380 : 6379)),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number.isInteger(db) ? db : 0,
    tls: tlsEnabled ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

// Parse BIGINT and NUMERIC as number for predictable API typing.
pgTypes.setTypeParser(20, (value: string) => Number(value));
pgTypes.setTypeParser(1700, (value: string) => Number(value));

export async function runApiServer(): Promise<void> {
  const config = loadApiRuntimeConfig();

  const pgPool = new Pool({ connectionString: config.pgUrl });
  const pg: PgClientLike = {
    async query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount?: number }> {
      const result = await pgPool.query(sql, params);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? undefined };
    },
  };

  const redis = new Redis(parseRedisOptions(config.redisUrl));

  const authService = new AuthService(
    new AuthUserPgRepository(pg),
    {
      jwtSecret: config.jwtSecret,
      jwtExpiresIn: config.jwtExpiresIn,
      bcryptRounds: config.bcryptRounds,
    },
  );
  const authMiddleware = createAuthMiddleware(authService) as RequestHandler;

  const logsRepository = new LogsPgRepository(pg);
  const logsService = new LogsService(logsRepository);
  const requestLogger = createRequestLoggerMiddleware(logsService);

  const errorLogsService = new ErrorLogsService(new ErrorLogsPgRepository(pg));
  const imageCacheService = new ImageCacheService(new ImageCachePgRepository(pg));

  const creditsService = new CreditsService(new CreditsPgRepository(pg));
  const taskRepository = new GeneratorTaskPgRepository(pg);
  const queue = createImageTaskQueue(parseRedisOptions(config.redisUrl));
  const queueGateway = new BullMQQueueGateway(queue);

  const rateLimitService = new RateLimitService(
    new RedisRateLimitStoreAdapter(redis),
    {
      perMinute: config.rateLimitPerMinute,
      perDay: config.rateLimitPerDay,
    },
  );

  const abuseService = new AbuseService(
    new AbuseRedisStoreAdapter(redis),
    new UserStatusPgGateway(pg),
    {
      registerPerIpPerDay: config.abuseRegisterPerIpPerDay,
      abnormalPerMinute: config.abuseAbnormalPerMinute,
      abnormalPerFiveMinutes: config.abuseAbnormalPerFiveMinutes,
    },
  );

  const promptSafetyService = new PromptSafetyService(new PromptWordBankPgRepository(pg));

  const usageService = new UsageService(new UsageLogsPgRepository(pg));

  const image2Client = config.useModelProviderRouter
    ? new MultiModelProviderRouter(
        new ModelProviderPgRepository(pg),
        {
          defaultModelType: config.imageModelStable,
          timeoutMs: config.imageRequestTimeoutMs,
          retriesPerProvider: config.imageRetriesPerProvider,
        },
        undefined,
        errorLogsService,
        logsService,
      )
    : new Image2FailoverClient(
        new ApiKeyPool(new ApiConfigRepositoryAdapter(new ApiConfigPgDataSource(pg))),
        {
          model: config.imageModelStable,
          timeoutMs: config.imageRequestTimeoutMs,
          retriesPerKey: config.imageRetriesPerProvider,
        },
        undefined,
        errorLogsService,
      );

  const generateImageTaskService = new GenerateImageTaskService({
    userGateway: new UserPgGateway(pg),
    creditsGateway: creditsService,
    styleGateway: new StylePgGateway(pg),
    taskRepository,
    queueGateway,
    imageCacheService,
    errorLogWriter: errorLogsService,
  });

  const cancelTaskService = new CancelTaskService(
    new CancelTaskPgRepositoryAdapter(taskRepository),
    queueGateway,
    creditsService,
  );

  const localUploadStorage = new LocalUploadStorage({
    baseDir: config.localUploadDir,
    publicBaseUrl: config.localUploadPublicBaseUrl,
  });

  const s3Storage = config.s3Enabled
    ? new AwsS3Storage({
        region: readRequired('S3_REGION'),
        bucket: readRequired('S3_BUCKET'),
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1' || process.env.S3_FORCE_PATH_STYLE === 'true',
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        publicBaseUrl: process.env.CDN_BASE_URL,
      })
    : null;

  const uploadStorage = s3Storage ?? localUploadStorage;

  const routerList: Router[] = [];

  routerList.push(createAuthModule({
    userRepository: new AuthUserPgRepository(pg),
    config: {
      jwtSecret: config.jwtSecret,
      jwtExpiresIn: config.jwtExpiresIn,
      bcryptRounds: config.bcryptRounds,
    },
    abuseService,
  }));
  const authPrefixedRouter = ExpressRouter();
  authPrefixedRouter.use('/auth', createAuthModule({
    userRepository: new AuthUserPgRepository(pg),
    config: {
      jwtSecret: config.jwtSecret,
      jwtExpiresIn: config.jwtExpiresIn,
      bcryptRounds: config.bcryptRounds,
    },
    abuseService,
  }));
  routerList.push(authPrefixedRouter);

  routerList.push(createGeneratorModule({
    authMiddleware,
    generateImageTaskService,
    cancelTaskService,
    taskQueryRepository: taskRepository,
    styleListRepository: taskRepository,
    rateLimitService,
    abuseService,
    promptSafetyService,
  }));

  routerList.push(createUploadModule({
    authMiddleware,
    storage: uploadStorage,
  }));

  routerList.push(createUserEventsModule({
    authMiddleware,
    repository: new UserEventsPgRepository(pg),
  }));

  routerList.push(createLogsModule({
    authMiddleware,
    repository: logsRepository,
  }));

  routerList.push(createBillingModule({
    authMiddleware,
    billingRepository: new BillingPgRepository(pg),
  }));

  routerList.push(createAdminModule({
    authMiddleware,
    repository: new AdminPgRepository(pg),
    usageService,
  }));

  routerList.push(createAbTestModule({
    authMiddleware,
    repository: new AbTestPgRepository(pg),
    generateGateway: generateImageTaskService,
  }));

  const readinessRouter = ExpressRouter();
  readinessRouter.get('/readyz', async (_req, res) => {
    const startedAt = Date.now();
    let pgOk = false;
    let redisOk = false;
    let s3Ok: boolean | null = null;

    try {
      await pgPool.query('SELECT 1');
      pgOk = true;
    } catch (_error) {
      pgOk = false;
    }

    try {
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
    } catch (_error) {
      redisOk = false;
    }

    if (config.s3Enabled) {
      const bucket = process.env.S3_BUCKET;
      const region = process.env.S3_REGION;
      if (bucket && region) {
        try {
          const s3 = new S3Client({
            region,
            endpoint: process.env.S3_ENDPOINT,
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1' || process.env.S3_FORCE_PATH_STYLE === 'true',
            credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
              ? {
                  accessKeyId: process.env.S3_ACCESS_KEY_ID,
                  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
                }
              : undefined,
          });
          await s3.send(new HeadBucketCommand({ Bucket: bucket }));
          s3Ok = true;
        } catch (_error) {
          s3Ok = false;
        }
      } else {
        s3Ok = false;
      }
    }

    const ready = pgOk && redisOk && (s3Ok === null || s3Ok);
    res.status(ready ? 200 : 503).json({
      ok: ready,
      checks: {
        postgres: pgOk ? 'up' : 'down',
        redis: redisOk ? 'up' : 'down',
        s3: s3Ok === null ? 'skipped' : (s3Ok ? 'up' : 'down'),
      },
      took_ms: Date.now() - startedAt,
      now: new Date().toISOString(),
    });
  });
  routerList.push(readinessRouter);

  const imageDetailRouter = ExpressRouter();
  imageDetailRouter.get('/image/:id', async (req, res) => {
    const imageId = Number(req.params.id);
    if (!Number.isInteger(imageId) || imageId <= 0) {
      res.status(400).json({ message: 'INVALID_IMAGE_ID' });
      return;
    }

    const result = await pg.query<{
      id: number;
      result_url: string | null;
      prompt: string;
      status: string;
    }>(
      `SELECT id, result_url, prompt, status
       FROM tasks
       WHERE id = $1
       LIMIT 1`,
      [imageId],
    );

    const row = result.rows[0];
    if (!row || row.status !== 'done' || !row.result_url) {
      res.status(404).json({ message: 'IMAGE_NOT_FOUND' });
      return;
    }

    res.status(200).json({
      id: row.id,
      result_url: row.result_url,
      prompt: row.prompt,
    });
  });
  routerList.push(imageDetailRouter);

  routerList.push(createLocalUploadStaticRouter({
    baseDir: config.localUploadDir,
    urlPrefix: config.localUploadUrlPrefix,
  }));

  const app = createApiApp({
    routers: routerList,
    requestLogger,
    jsonLimit: config.jsonLimit,
  });

  const shutdown = async () => {
    await Promise.allSettled([
      queue.close(),
      redis.quit(),
      pgPool.end(),
    ]);
  };

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });

  await startApiServer({
    app,
    port: config.apiPort,
    host: config.apiHost,
  });

  // eslint-disable-next-line no-console
  console.info(`API server listening on ${config.apiHost}:${config.apiPort}`);
}

export async function runWorker(): Promise<void> {
  const config = loadApiRuntimeConfig();

  const pgPool = new Pool({ connectionString: config.pgUrl });
  const pg: PgClientLike = {
    async query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount?: number }> {
      const result = await pgPool.query(sql, params);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? undefined };
    },
  };

  const redisOptions = parseRedisOptions(config.redisUrl);

  const errorLogsService = new ErrorLogsService(new ErrorLogsPgRepository(pg));
  const taskRepository = new GeneratorTaskPgRepository(pg);
  const creditsService = new CreditsService(new CreditsPgRepository(pg));
  const imageCacheRepository = new ImageCachePgRepository(pg);

  const logsRepository = new LogsPgRepository(pg);
  const logsService = new LogsService(logsRepository);

  const image2Client = config.useModelProviderRouter
    ? new MultiModelProviderRouter(
        new ModelProviderPgRepository(pg),
        {
          defaultModelType: config.imageModelStable,
          timeoutMs: config.imageRequestTimeoutMs,
          retriesPerProvider: config.imageRetriesPerProvider,
        },
        undefined,
        errorLogsService,
        logsService,
      )
    : new Image2FailoverClient(
        new ApiKeyPool(new ApiConfigRepositoryAdapter(new ApiConfigPgDataSource(pg))),
        {
          model: config.imageModelStable,
          timeoutMs: config.imageRequestTimeoutMs,
          retriesPerKey: config.imageRetriesPerProvider,
        },
        undefined,
        errorLogsService,
      );

  const localFallbackStorage = new LocalFallbackStorage({
    baseDir: config.localUploadDir,
    publicBaseUrl: config.localUploadPublicBaseUrl,
  });

  const s3Storage = config.s3Enabled
    ? new AwsS3Storage({
        region: readRequired('S3_REGION'),
        bucket: readRequired('S3_BUCKET'),
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1' || process.env.S3_FORCE_PATH_STYLE === 'true',
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        publicBaseUrl: process.env.CDN_BASE_URL,
      })
    : localFallbackStorage;

  const { createImageTaskWorker } = await import('./modules/generator/queue/image-task.worker');

  const worker = createImageTaskWorker({
    redis: redisOptions,
    concurrency: config.queueConcurrency,
    taskRepository,
    taskStateGateway: taskRepository,
    image2Client,
    s3Storage,
    imageProcessor: new SharpImageProcessor(),
    fallbackStorage: localFallbackStorage,
    imageCacheWriter: imageCacheRepository,
    creditsRollbackGateway: creditsService,
    errorLogWriter: errorLogsService,
    cdnBaseUrl: config.cdnBaseUrl,
    thumbnailWidth: config.workerThumbnailWidth,
    stableModelType: config.imageModelStable,
    newModelType: config.imageModelNew,
  });

  const shutdown = async () => {
    await Promise.allSettled([
      worker.close(),
      pgPool.end(),
    ]);
  };

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });

  // eslint-disable-next-line no-console
  console.info('Worker started and listening for image tasks');
}
