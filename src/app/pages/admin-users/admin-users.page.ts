import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem, IonLabel,
  IonInput, IonSelect, IonSelectOption, IonButton, IonBadge, IonText, IonIcon,
} from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { AuthProvider, User, UserRole } from '../../models/models';
import { ROLE_LABELS } from '../../config/ui.config';

/** App Owner-only user maintenance: add/edit/remove users and set auth method. */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem, IonLabel,
    IonInput, IonSelect, IonSelectOption, IonButton, IonBadge, IonText, IonIcon,
  ],
  templateUrl: './admin-users.page.html',
})
export class AdminUsersPage implements OnInit {
  users = signal<User[]>([]);
  error = signal<string | null>(null);
  readonly roleLabels = ROLE_LABELS;
  readonly roles: UserRole[] = ['business_user', 'it_user', 'admin', 'app_owner'];
  readonly providers: { value: AuthProvider; label: string }[] = [
    { value: 'entra-id', label: 'Entra ID' },
    { value: 'email-otp', label: 'OTP' },
  ];

  form: { email: string; name: string; role: UserRole; provider: AuthProvider } = {
    email: '', name: '', role: 'business_user', provider: 'entra-id',
  };

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.users.set(await this.api.listUsers());
  }

  async save(): Promise<void> {
    this.error.set(null);
    if (!this.form.email.includes('@') || !this.form.name) {
      this.error.set('Name and a valid email are required.');
      return;
    }
    try {
      await this.api.upsertUser(this.form);
      this.form = { email: '', name: '', role: 'business_user', provider: 'entra-id' };
      await this.reload();
    } catch (err) {
      this.error.set(this.msg(err));
    }
  }

  edit(u: User): void {
    this.form = { email: u.email, name: u.name, role: u.role, provider: u.provider };
  }

  async remove(u: User): Promise<void> {
    this.error.set(null);
    try {
      await this.api.deleteUser(u.id);
      await this.reload();
    } catch (err) {
      this.error.set(this.msg(err));
    }
  }

  private msg(err: unknown): string {
    const e = err as { error?: { error?: string }; message?: string };
    return e.error?.error ?? e.message ?? 'Action failed.';
  }
}
