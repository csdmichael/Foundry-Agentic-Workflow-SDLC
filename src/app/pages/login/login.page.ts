import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner, IonIcon, IonNote,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { uiConfig } from '../../config/ui.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner, IonIcon, IonNote,
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  readonly ui = uiConfig;
  readonly quickFills = uiConfig.auth.quickFill;
  email = '';
  code = '';
  step = signal<'email' | 'code'>('email');
  loading = signal(false);
  guestLoading = signal(false);
  error = signal<string | null>(null);
  info = signal<string | null>(null);

  constructor(private auth: AuthService, private router: Router, route: ActivatedRoute) {
    if (route.snapshot.queryParamMap.get('expired')) {
      this.info.set('Your session expired. Sign in again to continue.');
    }
  }

  quickFill(email: string): void {
    if (this.isBusy()) return;
    this.email = email;
    this.error.set(null);
  }

  async guest(): Promise<void> {
    if (this.isBusy()) return;
    this.error.set(null);
    this.guestLoading.set(true);
    try {
      await this.auth.loginAsGuest();
      this.router.navigate(['/dashboard']);
    } catch (err) {
      this.error.set(this.messageOf(err));
    } finally {
      this.guestLoading.set(false);
    }
  }

  async sendCode(): Promise<void> {
    if (this.isBusy()) return;
    this.error.set(null);
    this.info.set(null);
    if (!this.email.includes('@')) {
      this.error.set('Enter a valid email address.');
      return;
    }
    this.loading.set(true);
    try {
      const meta = await this.auth.getMeta();
      // Internal domains use Entra ID SSO; all others use email OTP.
      if (meta.entraEnabled && this.auth.isInternalEmail(this.email, meta)) {
        await this.auth.loginWithEntra(this.email);
        this.router.navigate(['/dashboard']);
        return;
      }
      const res = await this.auth.requestOtp(this.email);
      this.step.set('code');
      this.info.set(
        res.delivered
          ? 'A verification code was emailed to you. Check your junk folder if it does not arrive within a minute.'
          : 'Demo mode: check the API console/otp-log for your code (or use 000000).',
      );
    } catch (err) {
      this.error.set(this.messageOf(err));
    } finally {
      this.loading.set(false);
    }
  }

  async verify(): Promise<void> {
    if (this.isBusy()) return;
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.verifyOtp(this.email, this.code.trim());
      this.router.navigate(['/dashboard']);
    } catch (err) {
      this.error.set(this.messageOf(err));
    } finally {
      this.loading.set(false);
    }
  }

  async entra(): Promise<void> {
    if (this.isBusy()) return;
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.loginWithEntra(this.email || undefined);
      this.router.navigate(['/dashboard']);
    } catch (err) {
      this.error.set(this.messageOf(err));
    } finally {
      this.loading.set(false);
    }
  }

  reset(): void {
    if (this.isBusy()) return;
    this.step.set('email');
    this.code = '';
    this.error.set(null);
    this.info.set(null);
  }

  isBusy(): boolean {
    return this.loading() || this.guestLoading();
  }

  private messageOf(err: unknown): string {
    const e = err as { error?: { error?: string }; message?: string };
    return e.error?.error ?? e.message ?? 'Something went wrong.';
  }
}
