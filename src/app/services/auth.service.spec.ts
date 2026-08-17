import { HttpClient } from '@angular/common/http';
import { AuthUser } from '../models/models';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('shares one in-flight Entra interaction between concurrent callers', async () => {
    const service = new AuthService({} as HttpClient);
    const user: AuthUser = {
      sub: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      provider: 'entra-id',
      isInternal: true,
      role: 'it_user',
    };
    let resolveLogin!: (value: AuthUser) => void;
    const pendingLogin = new Promise<AuthUser>((resolve) => {
      resolveLogin = resolve;
    });
    const performLogin = spyOn(
      service as unknown as { performEntraLogin(loginHint?: string): Promise<AuthUser> },
      'performEntraLogin',
    ).and.returnValue(pendingLogin);

    const first = service.loginWithEntra('user@example.com');
    const second = service.loginWithEntra('user@example.com');

    expect(second).toBe(first);
    expect(performLogin).toHaveBeenCalledTimes(1);

    resolveLogin(user);
    await expectAsync(Promise.all([first, second])).toBeResolvedTo([user, user]);
  });
});