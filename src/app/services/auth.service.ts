import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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

  /**
   * Entra ID sign-in. When a UI client ID is configured, integrate MSAL here to
   * acquire an access token for the API scope, then call persistSession() with
   * that token. Until configured, this throws a friendly error so the UI can
   * steer users to OTP in local/demo mode.
   */
  async loginWithEntra(): Promise<never> {
    // TODO: wire @azure/msal-browser using meta.uiClientId / meta.authority.
    throw new Error('Entra ID sign-in requires MSAL configuration. Use Email OTP in demo mode.');
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
