import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { uiConfig } from '../config/ui.config';
import { AuthService } from './auth.service';

/**
 * Attaches the Bearer token and a correlation ID to outgoing API requests so
 * the correlation flows UI -> API -> APIM -> agents -> audit. On a 401 it
 * renews the Entra ID token once and retries; if renewal fails the session is
 * cleared instead of leaving a signed-in shell with a dead token.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(uiConfig.apiBaseUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const correlationId = crypto.randomUUID();

  const authorize = (request: HttpRequest<unknown>, token: string | null, replace = false) => {
    const headers: Record<string, string> = { [uiConfig.correlationHeader]: correlationId };
    // Sign-in calls /auth/me with the freshly acquired token before it becomes the
    // stored session; overwriting it here would send the stale token instead.
    if (token && (replace || !request.headers.has('Authorization'))) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return request.clone({ setHeaders: headers });
  };

  // The auth endpoints establish a session, so retrying them would loop.
  const isAuthEndpoint = req.url.startsWith(`${uiConfig.apiBaseUrl}/auth/`);

  return next(authorize(req, auth.token)).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isAuthEndpoint) return throwError(() => error);

      return from(auth.renewToken()).pipe(
        switchMap((token) => {
          if (!token) {
            auth.logout();
            router.navigate(['/login'], { queryParams: { expired: 1 } });
            return throwError(() => error);
          }
          return next(authorize(req, token, true));
        }),
      );
    }),
  );
};
