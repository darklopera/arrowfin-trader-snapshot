/**
 * Single place where process.env is read and validated. Fails FAST at boot:
 * a misconfigured security setting must stop the process, not degrade silently.
 */
export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  databaseUrl: string; // arrowfin_app: read-only, subject to RLS
  adminDatabaseUrl: string | null; // privileged writer: seed + dev fill simulator ONLY
  jwt: { secret: string; issuer: string; audience: string; ttlSeconds: number };
  webOrigin: string;
  devEndpoints: boolean; // POST /dev/fills and POST /auth/dev-login
  devApiKey: string | null;
  /** Pins "now" (ISO) so the demo matches the dataset cut. Ignored in production. */
  snapshotAsOf: Date | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const devEndpoints = env.ENABLE_DEV_ENDPOINTS === 'true';

  const secret = env.JWT_SECRET ?? '';
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  // Guarantee #1 that dev-only code cannot run in production (guarantee #2 is
  // that DevModule is not even imported unless this flag is on, see AppModule).
  if (isProduction && devEndpoints) {
    throw new Error('ENABLE_DEV_ENDPOINTS must not be true when NODE_ENV=production');
  }
  if (isProduction && env.SNAPSHOT_AS_OF) {
    throw new Error('SNAPSHOT_AS_OF must not be set when NODE_ENV=production');
  }
  if (devEndpoints && !env.DEV_API_KEY) {
    throw new Error('DEV_API_KEY is required when ENABLE_DEV_ENDPOINTS=true');
  }
  if (devEndpoints && !env.ADMIN_DATABASE_URL) {
    throw new Error('ADMIN_DATABASE_URL is required when ENABLE_DEV_ENDPOINTS=true');
  }

  return {
    nodeEnv,
    isProduction,
    port: Number(env.PORT ?? 4000),
    databaseUrl: env.DATABASE_URL,
    adminDatabaseUrl: env.ADMIN_DATABASE_URL ?? null,
    jwt: {
      secret,
      issuer: env.JWT_ISSUER ?? 'arrowfin-auth',
      audience: env.JWT_AUDIENCE ?? 'arrowfin-snapshot-api',
      ttlSeconds: Number(env.JWT_TTL_SECONDS ?? 900),
    },
    webOrigin: env.WEB_ORIGIN ?? 'http://localhost:3000',
    devEndpoints,
    devApiKey: env.DEV_API_KEY ?? null,
    snapshotAsOf: env.SNAPSHOT_AS_OF && !isProduction ? new Date(env.SNAPSHOT_AS_OF) : null,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
