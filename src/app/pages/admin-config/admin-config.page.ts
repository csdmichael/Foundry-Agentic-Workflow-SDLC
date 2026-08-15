import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonNote } from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';

/** Read-only view of non-secret config (APIM, integrations, guardrails). */
@Component({
  selector: 'app-admin-config',
  standalone: true,
  imports: [CommonModule, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonNote],
  template: `
    <h1>APIM & Configuration</h1>
    <ion-note color="medium">Secrets are never returned by the API. Values shown come from each tier's config folder.</ion-note>
    @if (cfg(); as c) {
      <ion-card>
        <ion-card-header><ion-card-title>APIM Gateway</ion-card-title></ion-card-header>
        <ion-card-content><pre>{{ pretty(c['apim']) }}</pre></ion-card-content>
      </ion-card>
      <ion-card>
        <ion-card-header><ion-card-title>Integrations</ion-card-title></ion-card-header>
        <ion-card-content><pre>{{ pretty(c['integrations']) }}</pre></ion-card-content>
      </ion-card>
      <ion-card>
        <ion-card-header><ion-card-title>Guardrails</ion-card-title></ion-card-header>
        <ion-card-content><pre>{{ pretty(c['guardrails']) }}</pre></ion-card-content>
      </ion-card>
    }
  `,
  styles: [`pre { white-space: pre-wrap; font-size: 0.78rem; background: var(--ion-color-step-50, #f7f7f7); padding: 10px; border-radius: 8px; }`],
})
export class AdminConfigPage implements OnInit {
  cfg = signal<Record<string, unknown> | null>(null);
  constructor(private api: ApiService) {}
  async ngOnInit(): Promise<void> {
    this.cfg.set(await this.api.getConfig());
  }
  pretty(v: unknown): string {
    return JSON.stringify(v, null, 2);
  }
}
