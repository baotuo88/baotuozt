import path from 'path';

function readStringEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  if (typeof fallback === 'string') {
    return fallback;
  }
  throw new Error(`MISSING_ENV:${name}`);
}

function readOptionalStringEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function readIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return parsed;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return fallback;
}

function normalizePublicBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export interface ApiRuntimeConfig {
  nodeEnv: string;
  apiPort: number;
  apiHost: string;
  jsonLimit: string;

  pgUrl: string;

  redisUrl: string;

  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;

  localUploadDir: string;
  localUploadUrlPrefix: string;
  localUploadPublicBaseUrl: string;

  // Worker / model / queue
  queueConcurrency: number;
  workerThumbnailWidth: number;
  imageModelStable: string;
  imageModelNew: string;
  imageRequestTimeoutMs: number;
  imageRetriesPerProvider: number;

  // Optional object storage
  s3Enabled: boolean;
  s3Region?: string;
  s3Endpoint?: string;
  s3ForcePathStyle: boolean;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  cdnBaseUrl?: string;

  // Feature switches
  useModelProviderRouter: boolean;

  // Abuse and rate limit configs
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  abuseRegisterPerIpPerDay: number;
  abuseAbnormalPerMinute: number;
  abuseAbnormalPerFiveMinutes: number;
}

export function loadApiRuntimeConfig(): ApiRuntimeConfig {
  const nodeEnv = readStringEnv('NODE_ENV', 'development');
  const apiPort = readIntegerEnv('API_PORT', 3000);
  const apiHost = readStringEnv('API_HOST', '0.0.0.0');
  const jsonLimit = readStringEnv('API_JSON_LIMIT', '20mb');

  const pgUrl = readStringEnv('DATABASE_URL');
  const redisUrl = readStringEnv('REDIS_URL', 'redis://127.0.0.1:6379');

  const jwtSecret = readStringEnv('JWT_SECRET');
  const jwtExpiresIn = readStringEnv('JWT_EXPIRES_IN', '7d');
  const bcryptRounds = Math.max(4, readIntegerEnv('BCRYPT_ROUNDS', 10));

  const localUploadDir = path.resolve(readStringEnv('LOCAL_UPLOAD_DIR', './storage'));
  const localUploadUrlPrefix = readStringEnv('LOCAL_UPLOAD_URL_PREFIX', '/uploaded');
  const localUploadPublicBaseUrl = normalizePublicBaseUrl(
    readStringEnv('LOCAL_UPLOAD_PUBLIC_BASE_URL', `http://127.0.0.1:${apiPort}${localUploadUrlPrefix}`),
  );

  const queueConcurrency = Math.max(1, readIntegerEnv('WORKER_CONCURRENCY', 5));
  const workerThumbnailWidth = Math.max(64, readIntegerEnv('WORKER_THUMBNAIL_WIDTH', 480));
  const imageModelStable = readStringEnv('IMAGE_MODEL_STABLE', 'gpt-image-1');
  const imageModelNew = readStringEnv('IMAGE_MODEL_NEW', 'gpt-image-1');
  const imageRequestTimeoutMs = Math.max(1000, readIntegerEnv('IMAGE_REQUEST_TIMEOUT_MS', 30000));
  const imageRetriesPerProvider = Math.max(1, readIntegerEnv('IMAGE_RETRIES_PER_PROVIDER', 3));

  const s3Enabled = readBooleanEnv('S3_ENABLED', false);
  const s3Region = readOptionalStringEnv('S3_REGION');
  const s3Endpoint = readOptionalStringEnv('S3_ENDPOINT');
  const s3ForcePathStyle = readBooleanEnv('S3_FORCE_PATH_STYLE', false);
  const s3Bucket = readOptionalStringEnv('S3_BUCKET');
  const s3AccessKeyId = readOptionalStringEnv('S3_ACCESS_KEY_ID');
  const s3SecretAccessKey = readOptionalStringEnv('S3_SECRET_ACCESS_KEY');
  const cdnBaseUrl = readOptionalStringEnv('CDN_BASE_URL');

  const useModelProviderRouter = readBooleanEnv('USE_MODEL_PROVIDER_ROUTER', true);

  const rateLimitPerMinute = Math.max(1, readIntegerEnv('RATE_LIMIT_PER_MINUTE', 5));
  const rateLimitPerDay = Math.max(1, readIntegerEnv('RATE_LIMIT_PER_DAY', 50));
  const abuseRegisterPerIpPerDay = Math.max(1, readIntegerEnv('ABUSE_REGISTER_PER_IP_PER_DAY', 3));
  const abuseAbnormalPerMinute = Math.max(1, readIntegerEnv('ABUSE_ABNORMAL_PER_MINUTE', 20));
  const abuseAbnormalPerFiveMinutes = Math.max(1, readIntegerEnv('ABUSE_ABNORMAL_PER_FIVE_MINUTES', 60));

  return {
    nodeEnv,
    apiPort,
    apiHost,
    jsonLimit,
    pgUrl,
    redisUrl,
    jwtSecret,
    jwtExpiresIn,
    bcryptRounds,
    localUploadDir,
    localUploadUrlPrefix,
    localUploadPublicBaseUrl,
    queueConcurrency,
    workerThumbnailWidth,
    imageModelStable,
    imageModelNew,
    imageRequestTimeoutMs,
    imageRetriesPerProvider,
    s3Enabled,
    s3Region,
    s3Endpoint,
    s3ForcePathStyle,
    s3Bucket,
    s3AccessKeyId,
    s3SecretAccessKey,
    cdnBaseUrl,
    useModelProviderRouter,
    rateLimitPerMinute,
    rateLimitPerDay,
    abuseRegisterPerIpPerDay,
    abuseAbnormalPerMinute,
    abuseAbnormalPerFiveMinutes,
  };
}
