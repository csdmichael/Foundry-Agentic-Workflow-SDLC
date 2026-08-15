/**
 * Central configuration loader (API tier).
 *
 * Loads non-secret JSON config from each tier's config folder and overlays
 * secrets from environment variables. Business logic must import from here
 * instead of hardcoding endpoints, keys, tenant IDs, or routes.
 */
import * as fs from 'fs';
import * as path from 'path';

function readJson<T>(relativePath: string): T {
  const full = path.resolve(__dirname, relativePath);
  const raw = fs.readFileSync(full, 'utf-8');
  return JSON.parse(raw) as T;
}

function env(name: string, fallback = ''): string {
  const raw = (process.env[name] ?? '').trim();
  return raw.length > 0 ? raw : fallback;
}

function envFlag(name: string): boolean {
  return env(name) === '1';
}

// ---- Typed config shapes (subset; JSON is the source of truth) ----
export interface ApiConfig {
  service: { name: string; port: number; corsAllowedOrigins: string[] };
  auth: {
    internalDomains: string[];
    internal: { authorityBase: string; apiScopeName: string };
    external: {
      otpLength: number;
      otpTtlSeconds: number;
      maxAttemptsPerCode: number;
      maxCodesPerEmailPerHour: number;
      sessionTtlSeconds: number;
      emailFrom: string;
      emailFromName: string;
      emailSubject: string;
    };
    jwt: { issuer: string; audience: string; algorithm: string; accessTokenTtlSeconds: number };
  };
  correlation: { headerName: string };
  upload: { maxFileSizeBytes: number; allowedExtensions: string[] };
}

export interface ApimConfig {
  gateway: {
    baseUrl: string;
    authMode: string;
    subscriptionKeyHeader: string;
    correlationIdHeader: string;
    timeoutMs: number;
    retry: { maxRetries: number; backoffMs: number; retryOnStatuses: number[] };
    throttlingPolicyName: string;
  };
  foundry: {
    projectEndpoint: string;
    allowDirectInLocalDevOnly: boolean;
    routes: Record<string, string>;
  };
  logging: { capturedFields: string[] };
}

export interface PersistenceConfig {
  provider: 'file' | 'cosmos';
  file: { dataRoot: string };
  cosmos: {
    endpoint: string;
    database: string;
    useManagedIdentity: boolean;
    containers: Record<string, { partitionKey: string }>;
  };
}

const apiConfig = readJson<ApiConfig>('./api.config.json');
const apimConfig = readJson<ApimConfig>('../config/apim.config.json');
const integrationsConfig = readJson<Record<string, any>>('./integrations.config.json');
const guardrailsConfig = readJson<Record<string, any>>('./guardrails.config.json');
const persistenceConfig = readJson<PersistenceConfig>('../persistence/config/persistence.config.json');
const agentsConfig = readJson<Record<string, any>>('../agents/config/agents.config.json');
const seedUsers = readJson<{ seedUsers: any[] }>('./seed-users.json').seedUsers;

// Overlay port from env if present.
apiConfig.service.port = Number(env('PORT', String(apiConfig.service.port)));

// Allow tests / deployments to redirect the local file store.
persistenceConfig.file.dataRoot = env('PERSIST_FILE_DATA_ROOT', persistenceConfig.file.dataRoot);

export const config = {
  api: apiConfig,
  apim: apimConfig,
  integrations: integrationsConfig,
  guardrails: guardrailsConfig,
  persistence: persistenceConfig,
  agents: agentsConfig,
  seedUsers,

  // ---- Secrets & runtime flags (env-only; never persisted) ----
  secrets: {
    entraTenantId: env('AUTH_ENTRA_TENANT_ID'),
    entraUiClientId: env('AUTH_ENTRA_UI_CLIENT_ID'),
    entraApiClientId: env('AUTH_ENTRA_API_CLIENT_ID'),
    entraApiAppIdUri: env('AUTH_ENTRA_API_APP_ID_URI'),
    jwtSigningKey: env('AUTH_JWT_SIGNING_KEY', 'dev-insecure-signing-key-change-me'),
    acsConnectionString: env('AUTH_ACS_CONNECTION_STRING'),
    acsSenderAddress: env('AUTH_ACS_SENDER_ADDRESS'),
    apimSubscriptionKey: env('APIM_SUBSCRIPTION_KEY'),
    cosmosConnectionString: env('PERSIST_COSMOS_CONNECTION_STRING'),
    cosmosEndpoint: env('PERSIST_COSMOS_ENDPOINT'),
    cosmosDatabase: env('PERSIST_COSMOS_DATABASE'),
  },
  flags: {
    otpDevBypass: envFlag('AUTH_OTP_DEV_BYPASS'),
    allowAnonymous: envFlag('AUTH_ALLOW_ANONYMOUS'),
    foundryAllowDirect: envFlag('FOUNDRY_ALLOW_DIRECT'),
    nodeEnv: env('NODE_ENV', 'development'),
  },
};

export type AppConfig = typeof config;

export function entraAuthority(): string {
  const tid = config.secrets.entraTenantId;
  if (!tid) return '';
  return `${config.api.auth.internal.authorityBase}/${tid}`;
}

export function entraJwksUri(): string {
  const tid = config.secrets.entraTenantId;
  if (!tid) return '';
  return `${config.api.auth.internal.authorityBase}/${tid}/discovery/v2.0/keys`;
}
