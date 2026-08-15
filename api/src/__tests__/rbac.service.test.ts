import { hasCapability, canApprove, capabilitiesFor } from '../services/rbac.service';

describe('RBAC policy', () => {
  it('lets only App Owner manage users', () => {
    expect(hasCapability('app_owner', 'users.manage')).toBe(true);
    expect(hasCapability('admin', 'users.manage')).toBe(false);
    expect(hasCapability('business_user', 'users.manage')).toBe(false);
    expect(hasCapability('it_user', 'users.manage')).toBe(false);
  });

  it('grants Admin full access except user maintenance', () => {
    expect(hasCapability('admin', 'config.manage')).toBe(true);
    expect(hasCapability('admin', 'agents.configure')).toBe(true);
    expect(hasCapability('admin', 'users.manage')).toBe(false);
  });

  it('limits Business User to business capabilities', () => {
    expect(hasCapability('business_user', 'projects.create')).toBe(true);
    expect(hasCapability('business_user', 'approvals.business')).toBe(true);
    expect(hasCapability('business_user', 'approvals.technical')).toBe(false);
    expect(hasCapability('business_user', 'agents.configure')).toBe(false);
  });

  it('limits IT User to technical review', () => {
    expect(hasCapability('it_user', 'approvals.technical')).toBe(true);
    expect(hasCapability('it_user', 'projects.create')).toBe(false);
  });

  it('canApprove: admin/app_owner can approve any gate; others only their role', () => {
    expect(canApprove('app_owner', 'it_user')).toBe(true);
    expect(canApprove('admin', 'business_user')).toBe(true);
    expect(canApprove('business_user', 'business_user')).toBe(true);
    expect(canApprove('business_user', 'it_user')).toBe(false);
    expect(canApprove('it_user', 'admin')).toBe(false);
  });

  it('capabilitiesFor returns a copy', () => {
    const caps = capabilitiesFor('admin');
    caps.push('users.manage');
    expect(capabilitiesFor('admin')).not.toContain('users.manage');
  });
});
