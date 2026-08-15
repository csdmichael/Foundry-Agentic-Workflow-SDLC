/**
 * Role-based access control (RBAC) policy. Central definition of what each role
 * may do. Enforced on the API (source of truth) and mirrored in the UI to hide
 * unauthorized navigation.
 */
import { UserRole } from '../models';

/** Coarse-grained capability names used across routes and UI sections. */
export type Capability =
  | 'projects.read'
  | 'projects.create'
  | 'projects.manage'
  | 'approvals.business'
  | 'approvals.technical'
  | 'approvals.admin'
  | 'agents.read'
  | 'agents.configure'
  | 'agents.run'
  | 'config.manage'
  | 'audit.read'
  | 'users.read'
  | 'users.manage';

const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  business_user: [
    'projects.read',
    'projects.create',
    'approvals.business',
    'agents.read',
    'audit.read',
  ],
  it_user: [
    'projects.read',
    'approvals.technical',
    'agents.read',
    'audit.read',
  ],
  admin: [
    'projects.read',
    'projects.create',
    'projects.manage',
    'approvals.business',
    'approvals.technical',
    'approvals.admin',
    'agents.read',
    'agents.configure',
    'agents.run',
    'config.manage',
    'audit.read',
    'users.read',
  ],
  app_owner: [
    'projects.read',
    'projects.create',
    'projects.manage',
    'approvals.business',
    'approvals.technical',
    'approvals.admin',
    'agents.read',
    'agents.configure',
    'agents.run',
    'config.manage',
    'audit.read',
    'users.read',
    'users.manage',
  ],
};

export function hasCapability(role: UserRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/** Whether `role` may approve a gate that requires `requiredRole`. */
export function canApprove(role: UserRole, requiredRole: UserRole): boolean {
  if (role === 'app_owner' || role === 'admin') return true;
  return role === requiredRole;
}

export function capabilitiesFor(role: UserRole): Capability[] {
  return [...(ROLE_CAPABILITIES[role] ?? [])];
}
