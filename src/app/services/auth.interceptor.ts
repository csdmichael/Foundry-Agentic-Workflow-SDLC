import { HttpInterceptorFn } from '@angular/common/http';
import { uiConfig } from '../config/ui.config';

/**
 * Attaches the Bearer token and a correlation ID to outgoing API requests so
 * the correlation flows UI -> API -> APIM -> agents -> audit.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(uiConfig.apiBaseUrl)) {
    return next(req);
  }
  const token = localStorage.getItem(uiConfig.tokenStorageKey);
  const correlationId = crypto.randomUUID();
  const headers: Record<string, string> = { [uiConfig.correlationHeader]: correlationId };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return next(req.clone({ setHeaders: headers }));
};
