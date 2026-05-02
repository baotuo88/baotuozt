import express, { type Express, type RequestHandler, type Router } from 'express';

export interface CreateApiAppInput {
  routers: Router[];
  requestLogger?: RequestHandler;
  jsonLimit?: string;
  trustProxy?: boolean;
  allowedOrigins?: string[];
  enableCors?: boolean;
  enableSecurityHeaders?: boolean;
}

function setSecurityHeaders(res: Parameters<RequestHandler>[1]): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
}

function parseOriginList(origins: string[] | undefined): Set<string> {
  return new Set(
    (origins ?? [])
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return undefined;
}

function parseListEnv(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveTrustProxy(input?: boolean): boolean {
  if (typeof input === 'boolean') {
    return input;
  }
  return parseBooleanEnv(process.env.API_TRUST_PROXY) ?? true;
}

function resolveEnableCors(input?: boolean): boolean {
  if (typeof input === 'boolean') {
    return input;
  }
  return parseBooleanEnv(process.env.API_ENABLE_CORS) ?? true;
}

function resolveEnableSecurityHeaders(input?: boolean): boolean {
  if (typeof input === 'boolean') {
    return input;
  }
  return parseBooleanEnv(process.env.API_ENABLE_SECURITY_HEADERS) ?? true;
}

function resolveAllowedOrigins(input?: string[]): string[] | undefined {
  if (Array.isArray(input)) {
    return input;
  }
  return parseListEnv(process.env.API_ALLOWED_ORIGINS);
}

function isProductionEnvironment(): boolean {
  return (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

export function createApiApp(input: CreateApiAppInput): Express {
  const app = express();
  const trustProxyEnabled = resolveTrustProxy(input.trustProxy);
  const corsEnabled = resolveEnableCors(input.enableCors);
  const securityHeadersEnabled = resolveEnableSecurityHeaders(input.enableSecurityHeaders);
  const allowedOrigins = parseOriginList(resolveAllowedOrigins(input.allowedOrigins));
  const productionEnvironment = isProductionEnvironment();

  if (trustProxyEnabled) {
    app.set('trust proxy', 1);
  }

  if (securityHeadersEnabled) {
    app.use((_req, res, next) => {
      setSecurityHeaders(res);
      next();
    });
  }

  if (corsEnabled) {
    app.use((req, res, next) => {
      const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
      const allowAll = !productionEnvironment && allowedOrigins.size === 0;
      const allowCurrent = Boolean(requestOrigin) && (allowAll || (requestOrigin ? allowedOrigins.has(requestOrigin) : false));

      if (allowCurrent && requestOrigin) {
        if (allowAll) {
          res.setHeader('Access-Control-Allow-Origin', '*');
        } else {
          res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        }
      }

      if (!productionEnvironment && allowAll && !requestOrigin) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-upload-file-name, x-upload-mime-type');
      if (req.method === 'OPTIONS') {
        if (requestOrigin && !allowCurrent) {
          res.status(403).json({ message: 'CORS_ORIGIN_NOT_ALLOWED' });
          return;
        }
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.use(express.json({ limit: input.jsonLimit ?? '20mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (input.requestLogger) {
    app.use(input.requestLogger);
  }

  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      ok: true,
      now: new Date().toISOString(),
    });
  });

  for (const router of input.routers) {
    app.use(router);
  }

  return app;
}
