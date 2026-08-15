/**
 * User directory service. Seeds initial App Owners from config on first run,
 * derives the human-facing authentication method, and enforces that only
 * App Owners maintain users (checked again at the route layer).
 */
import { v4 as uuid } from 'uuid';
import { getRepository } from '../persistence/factory';
import { config } from '../config';
import { AuthProvider, User, UserRole, ALL_ROLES } from '../models';

const repo = () => getRepository<User>('users');

function methodFor(provider: AuthProvider): User['authenticationMethod'] {
  return provider === 'email-otp' ? 'OTP' : 'Entra ID';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function ensureSeedUsers(): Promise<void> {
  for (const seed of config.seedUsers) {
    const email = normalizeEmail(seed.email);
    const existing = await getByEmail(email);
    if (existing) continue;
    const now = new Date().toISOString();
    await repo().upsert({
      id: uuid(),
      email,
      name: seed.name,
      role: seed.role as UserRole,
      provider: seed.provider as AuthProvider,
      authenticationMethod: methodFor(seed.provider as AuthProvider),
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function getByEmail(email: string): Promise<User | undefined> {
  const target = normalizeEmail(email);
  const rows = await repo().find((u) => u.email === target);
  return rows[0];
}

export async function getById(id: string): Promise<User | undefined> {
  return repo().getById(id);
}

export async function list(): Promise<User[]> {
  return (await repo().getAll()).sort((a, b) => a.email.localeCompare(b.email));
}

export interface UpsertUserInput {
  email: string;
  name: string;
  role: UserRole;
  provider: AuthProvider;
  disabled?: boolean;
}

export async function createOrUpdate(input: UpsertUserInput): Promise<User> {
  if (!ALL_ROLES.includes(input.role)) {
    throw Object.assign(new Error(`Invalid role: ${input.role}`), { status: 400 });
  }
  const email = normalizeEmail(input.email);
  const existing = await getByEmail(email);
  const now = new Date().toISOString();
  const user: User = {
    id: existing?.id ?? uuid(),
    email,
    name: input.name,
    role: input.role,
    provider: input.provider,
    authenticationMethod: methodFor(input.provider),
    disabled: input.disabled ?? existing?.disabled ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return repo().upsert(user);
}

export async function remove(id: string): Promise<boolean> {
  return repo().delete(id);
}

/** Resolve a user for an authenticated email, defaulting new internal users. */
export async function resolveForLogin(
  email: string,
  name: string,
  provider: AuthProvider,
): Promise<User> {
  const existing = await getByEmail(email);
  if (existing) return existing;
  // Unknown users default to business_user; App Owner can elevate later.
  return createOrUpdate({ email, name, role: 'business_user', provider });
}
