import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput,
  IonSelect, IonSelectOption, IonList, IonNote, IonText, IonButton, IonSpinner,
} from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { SystemOfRecordCatalogEntry, SystemOfRecordMap } from '../../models/models';
import { PROVIDER_LABELS } from '../../config/ui.config';

/**
 * Global System of Record settings. Every project inherits these values unless
 * it overrides them on the project's own settings card.
 */
@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput,
    IonSelect, IonSelectOption, IonList, IonNote, IonText, IonButton, IonSpinner,
  ],
  template: `
    <h1>Global Settings</h1>
    <ion-note color="medium">
      Systems of Record apply to every project unless a project overrides them. Changes are audited.
    </ion-note>

    @if (error()) { <ion-text color="danger"><p>{{ error() }}</p></ion-text> }
    @if (saved()) { <ion-text color="success"><p>Global settings saved.</p></ion-text> }

    @if (catalog().length === 0) {
      <ion-spinner></ion-spinner>
    } @else {
      @for (entry of catalog(); track entry.key) {
        <ion-card>
          <ion-card-header><ion-card-title>{{ entry.label }}</ion-card-title></ion-card-header>
          <ion-card-content>
            <p class="muted">{{ entry.description }}</p>
            <ion-list>
              <ion-item>
                <ion-label position="stacked">System of record</ion-label>
                <ion-select [(ngModel)]="settings[entry.key].provider" interface="popover">
                  @for (p of entry.allowedProviders; track p) {
                    <ion-select-option [value]="p">{{ providerLabel(p) }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">URL</ion-label>
                <ion-input [(ngModel)]="settings[entry.key].url" [placeholder]="entry.urlHint"></ion-input>
              </ion-item>
              @if (entry.requiresProject) {
                <ion-item>
                  <ion-label position="stacked">Project / repository</ion-label>
                  <ion-input [(ngModel)]="settings[entry.key].project" placeholder="AgenticSDLC"></ion-input>
                </ion-item>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>
      }

      <div style="display:flex;gap:8px;">
        <ion-button (click)="save()" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save global settings' }}
        </ion-button>
        <ion-button fill="outline" (click)="resetToConfigDefaults()" [disabled]="saving()">
          Reset to config defaults
        </ion-button>
      </div>
    }
  `,
  styles: [`.muted { color: var(--ion-color-medium); font-size: 0.85rem; }`],
})
export class AdminSettingsPage implements OnInit {
  catalog = signal<SystemOfRecordCatalogEntry[]>([]);
  settings: SystemOfRecordMap = {};
  saving = signal(false);
  saved = signal(false);
  error = signal<string | null>(null);

  private configDefaults: SystemOfRecordMap = {};

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.api.getSystemsOfRecord();
      this.catalog.set(res.catalog);
      this.configDefaults = res.configDefaults ?? {};
      this.settings = structuredClone(res.settings);
    } catch (err) {
      this.error.set(this.message(err));
    }
  }

  providerLabel(provider: string): string {
    return PROVIDER_LABELS[provider] ?? provider;
  }

  resetToConfigDefaults(): void {
    this.settings = structuredClone(this.configDefaults);
    this.saved.set(false);
  }

  async save(): Promise<void> {
    this.error.set(null);
    this.saved.set(false);
    this.saving.set(true);
    try {
      const res = await this.api.updateSystemsOfRecord(this.settings);
      this.settings = structuredClone(res.settings);
      this.saved.set(true);
    } catch (err) {
      this.error.set(this.message(err));
    } finally {
      this.saving.set(false);
    }
  }

  private message(err: unknown): string {
    const e = err as { error?: { error?: string }; message?: string };
    return e.error?.error ?? e.message ?? 'Request failed.';
  }
}
