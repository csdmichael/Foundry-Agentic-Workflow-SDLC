/**
 * Authentication service. Two flows, ported from the reference project's
 * patterns (no secrets copied):
 *
 * 1. Microsoft Entra ID for internal users. The UI acquires an access token via
 *    MSAL and sends it as a Bearer token. The API validates the signature
 *    against the tenant JWKS endpoint.
 * 2. Email OTP for external users. A 6-digit code is hashed (SHA-256 + salt)
 *    and stored with a TTL and per-email rate limit. On verify, the API issues
 *    an HS256 app JWT used as the Bearer token for subsequent calls.
 *
 * Secrets (JWT signing key, ACS connection string) come from env vars only.
 */
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { config, entraAuthority, entraJwksUri } from '../config';
import { AuthProvider, AuthUser, User } from '../models';
import * as users from './users.service';
import { sendOtpEmail } from './email.service';

interface OtpEntry {
  hash: string;
  salt: string;
  expiresAt: number;
  attempts: number;
}

// In-memory OTP store. Acceptable for single-instance dev/demo; back with a
// shared store (e.g. Cosmos/Redis) for multi-instance scale-out.
const otpStore = new Map<string, OtpEntry>();
const rateBuckets = new Map<string, number[]>();

function isInternalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return config.api.auth.internalDomains.some((d) => d.toLowerCase() === domain);
}

// ---------------------------------------------------------------------------
// OTP flow
// ---------------------------------------------------------------------------

export async function requestOtp(email: string): Promise<{ delivered: boolean }> {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const ext = config.api.auth.external;

  // Rate limit: max codes per email per hour.
  const bucket = (rateBuckets.get(key) ?? []).filter((t) => t > now - 3600_000);
  if (bucket.length >= ext.maxCodesPerEmailPerHour) {
    throw Object.assign(new Error('Too many OTP requests. Try again later.'), { status: 429 });
  }
  bucket.push(now);
  rateBuckets.set(key, bucket);

  const code = generateOtp(ext.otpLength);
  const salt = crypto.randomBytes(16).toString('hex');
  otpStore.set(key, {
    hash: hashCode(key, code, salt),
    salt,
    expiresAt: now + ext.otpTtlSeconds * 1000,
    attempts: 0,
  });

  const delivered = await sendOtpEmail(key, code);
  return { delivered };
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ token: string; expiresIn: number; user: AuthUser }> {
  const key = email.trim().toLowerCase();

  // DEV/DEMO ONLY bypass code.
  if (config.flags.otpDevBypass && code === '000000') {
    return issueForOtpUser(key);
  }

  const entry = otpStore.get(key);
  if (!entry) {
    throw Object.assign(new Error('No active code. Request a new one.'), { status: 400 });
  }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    throw Object.assign(new Error('Code expired. Request a new one.'), { status: 400 });
  }
  if (entry.attempts >= config.api.auth.external.maxAttemptsPerCode) {
    otpStore.delete(key);
    throw Object.assign(new Error('Too many attempts. Request a new one.'), { status: 429 });
  }
  entry.attempts += 1;
  const candidate = hashCode(key, code, entry.salt);
  if (!crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(entry.hash))) {
    throw Object.assign(new Error('Invalid code.'), { status: 401 });
  }
  otpStore.delete(key);
  return issueForOtpUser(key);
}

async function issueForOtpUser(
  email: string,
): Promise<{ token: string; expiresIn: number; user: AuthUser }> {
  const record = await users.resolveForLogin(email, email.split('@')[0], 'email-otp');
  const authUser = toAuthUser(record, 'email-otp');
  const expiresIn = config.api.auth.jwt.accessTokenTtlSeconds;
  const token = jwt.sign(
    { sub: authUser.sub, email: authUser.email, name: authUser.name, role: authUser.role, provider: 'email-otp' },
    config.secrets.jwtSigningKey,
    {
      algorithm: 'HS256',
      issuer: config.api.auth.jwt.issuer,
      audience: config.api.auth.jwt.audience,
      expiresIn,
    },
  );
  return { token, expiresIn, user: authUser };
}

// ---------------------------------------------------------------------------
// Bearer token verification (used by auth middleware)
// ---------------------------------------------------------------------------

let jwks: JwksClient | undefined;

export async function verifyBearer(token: string): Promise<AuthUser> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw Object.assign(new Error('Malformed token'), { status: 401 });
  }
  const alg = decoded.header.alg;

  // App-issued OTP tokens use HS256.
  if (alg === 'HS256') {
    const payload = jwt.verify(token, config.secrets.jwtSigningKey, {
      issuer: config.api.auth.jwt.issuer,
      audience: config.api.auth.jwt.audience,
    }) as jwt.JwtPayload;
    const record = await users.getByEmail(String(payload.email));
    return toAuthUser(record ?? fallbackUser(payload), 'email-otp');
  }

  // Entra ID tokens are RS256 — validate against tenant JWKS.
  return verifyEntraToken(token, decoded);
}

async function verifyEntraToken(token: string, decoded: jwt.Jwt): Promise<AuthUser> {
  const jwksUri = entraJwksUri();
  if (!jwksUri) {
    throw Object.assign(new Error('Entra ID not configured'), { status: 401 });
  }
  if (!jwks) {
    jwks = new JwksClient({ jwksUri, cache: true, rateLimit: true });
  }
  const kid = decoded.header.kid;
  const signingKey = await jwks.getSigningKey(kid);
  const publicKey = signingKey.getPublicKey();
  const payload = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: [
      `${entraAuthority()}/v2.0`,
      `https://sts.windows.net/${config.secrets.entraTenantId}/`,
    ],
  }) as jwt.JwtPayload;

  const email = String(payload.preferred_username || payload.email || payload.upn || '');
  const name = String(payload.name || email.split('@')[0]);
  const record = await users.resolveForLogin(email, name, 'entra-id');
  return { ...toAuthUser(record, 'entra-id'), tenantId: config.secrets.entraTenantId };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toAuthUser(user: User, provider: AuthProvider): AuthUser {
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    provider,
    isInternal: isInternalEmail(user.email),
    role: user.role,
  };
}

function fallbackUser(payload: jwt.JwtPayload): User {
  const email = String(payload.email ?? '');
  const now = new Date().toISOString();
  return {
    id: String(payload.sub ?? email),
    email,
    name: String(payload.name ?? email),
    role: 'business_user',
    provider: 'email-otp',
    authenticationMethod: 'OTP',
    createdAt: now,
    updatedAt: now,
  };
}

function generateOtp(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += crypto.randomInt(0, 10).toString();
  return out;
}

function hashCode(email: string, code: string, salt: string): string {
  return crypto.createHash('sha256').update(`${email}|${code}|${salt}`).digest('hex');
}

export function authMeta() {
  return {
    tenantId: config.secrets.entraTenantId,
    uiClientId: config.secrets.entraUiClientId,
    apiClientId: config.secrets.entraApiClientId,
    apiAppIdUri: config.secrets.entraApiAppIdUri,
    authority: entraAuthority(),
    apiScopeName: config.api.auth.internal.apiScopeName,
    internalDomains: config.api.auth.internalDomains,
    otpEnabled: true,
    otpDevBypass: config.flags.otpDevBypass,
  };
}
