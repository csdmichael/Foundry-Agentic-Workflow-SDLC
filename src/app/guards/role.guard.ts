import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Route guard factory that requires ALL listed capabilities. UI-side hiding is
 * complemented by server-side authorization, so a bypassed nav still fails at
 * the API.
 */
export function requireCapabilities(...capabilities: string[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }
    if (auth.capabilities().length === 0) {
      await auth.loadCapabilities();
    }
    const ok = capabilities.every((c) => auth.hasCapability(c));
    if (!ok) {
      router.navigate(['/access-denied']);
      return false;
    }
    return true;
  };
}
