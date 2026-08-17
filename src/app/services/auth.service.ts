import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PublicClientApplication, type IPublicClientApplication } from '@azure/msal-browser';
import { uiConfig } from '../config/ui.config';
import { AuthUser } from '../models/models';

interface OtpVerifyResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

interface AuthMeta {
  tenantId: string;
  uiClientId: string;
  authority: string;
  internalDomains: string[];
  entraEnabled: boolean;
  otpEnabled: boolean;
  otpDevBypass: boolean;
}

/**
 * Authentication state and flows for the UI. Supports Email OTP end-to-end and
 * exposes Entra ID metadata for MSAL integration (bearer token acquisition is
 * wired where a client ID is configured — see TODO in loginWithEntra()).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<AuthUser | null>(this.restoreUser());
  private readonly _capabilities = signal<string[]>([]);
  private _metaCache?: AuthMeta;
  private msal?: IPublicClientApplication;
  private entraLogin?: Promise<AuthUser>;

  readonly user = this._user.asReadonly();
  readonly capabilities = this._capabilities.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor(private http: HttpClient) {}

  get token(): string | null {
    return localStorage.getItem(uiConfig.tokenStorageKey);
  }

  meta(): Promise<AuthMeta> {
    return firstValueFrom(this.http.get<AuthMeta>(`${uiConfig.apiBaseUrl}/auth/meta`));
  }

  /** Cached auth metadata (tenant, client id, internal domains). */
  async getMeta(): Promise<AuthMeta> {
    if (!this._metaCache) this._metaCache = await this.meta();
    return this._metaCache;
  }

  /** Whether the email's domain is an internal (Entra ID SSO) domain. */
  isInternalEmail(email: string, meta: AuthMeta): boolean {
    const domain = email.split('@')[1]?.toLowerCase() ?? '';
    return meta.internalDomains.some((d) => d.toLowerCase() === domain);
  }

  async requestOtp(email: string): Promise<{ delivered: boolean }> {
    return firstValueFrom(
      this.http.post<{ requested: boolean; delivered: boolean }>(
        `${uiConfig.apiBaseUrl}/auth/otp/request`,
        { email },
      ),
    );
  }

  async verifyOtp(email: string, code: string): Promise<AuthUser> {
    const res = await firstValueFrom(
      this.http.post<OtpVerifyResponse>(`${uiConfig.apiBaseUrl}/auth/otp/verify`, { email, code }),
    );
    this.persistSession(res.accessToken, res.user);
    await this.loadCapabilities();
    return res.user;
  }

  /** Guest read-only sign-in — explore generated ontologies/artifacts, no writes. */
  async loginAsGuest(): Promise<AuthUser> {
    const res = await firstValueFrom(
      this.http.post<OtpVerifyResponse>(`${uiConfig.apiBaseUrl}/auth/guest`, {}),
    );
    this.persistSession(res.accessToken, res.user);
    await this.loadCapabilities();
    return res.user;
  }

  /**
   * Entra ID single sign-on (MSAL). Internal-domain users authenticate here;
   * the acquired ID token is sent as the Bearer to the API, which validates it
   * against the tenant JWKS and resolves the user's role.
   */
  loginWithEntra(loginHint?: string): Promise<AuthUser> {
    if (this.entraLogin) return this.entraLogin;

    const login = this.performEntraLogin(loginHint);
    this.entraLogin = login.finally(() => {
      this.entraLogin = undefined;
    });
    return this.entraLogin;
  }

  private async performEntraLogin(loginHint?: string): Promise<AuthUser> {
    const meta = await this.getMeta();
    if (!meta.entraEnabled || !meta.uiClientId || !meta.tenantId) {
      throw new Error('Entra ID sign-in is not configured. Use Email OTP.');
    }
    const msal = await this.getMsal(meta);
    const result = await msal.loginPopup({
      scopes: ['openid', 'profile', 'email'],
      loginHint,
    });
    const idToken = result.idToken;
    // Resolve the authoritative identity/role from the API using the Entra token.
    const me = await firstValueFrom(
      this.http.get<{ user: AuthUser }>(`${uiConfig.apiBaseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${idToken}` },
      }),
    );
    this.persistSession(idToken, me.user);
    await this.loadCapabilities();
    return me.user;
  }

  private async getMsal(meta: AuthMeta): Promise<IPublicClientApplication> {
    if (this.msal) return this.msal;
    const app = new PublicClientApplication({
      auth: {
        clientId: meta.uiClientId,
        authority: meta.authority || `https://login.microsoftonline.com/${meta.tenantId}`,
        // Dedicated static page so the popup doesn't reload the SPA (which would
        // strip the auth code from the URL and re-show the login page).
        redirectUri: `${window.location.origin}/assets/msal-redirect.html`,
      },
      cache: { cacheLocation: 'localStorage' },
    });
    await app.initialize();
    this.msal = app;
    return app;
  }

  async loadCapabilities(): Promise<void> {
    if (!this.token) return;
    const res = await firstValueFrom(
      this.http.get<{ role: string; capabilities: string[] }>(`${uiConfig.apiBaseUrl}/config/capabilities`),
    );
    this._capabilities.set(res.capabilities);
  }

  hasCapability(capability: string): boolean {
    return this._capabilities().includes(capability);
  }

  logout(): void {
    localStorage.removeItem(uiConfig.tokenStorageKey);
    localStorage.removeItem(uiConfig.userStorageKey);
    this._user.set(null);
    this._capabilities.set([]);
  }

  private persistSession(token: string, user: AuthUser): void {
    localStorage.setItem(uiConfig.tokenStorageKey, token);
    localStorage.setItem(uiConfig.userStorageKey, JSON.stringify(user));
    this._user.set(user);
  }

  private restoreUser(): AuthUser | null {
    const raw = localStorage.getItem(uiConfig.userStorageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
