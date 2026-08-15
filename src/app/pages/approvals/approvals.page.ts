import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonList, IonItem, IonLabel, IonBadge, IonButton, IonNote, IonText,
} from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { ApprovalGate } from '../../models/models';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, RouterLink, IonList, IonItem, IonLabel, IonBadge, IonButton, IonNote, IonText],
  template: `
    <h1>Human Approval Queue</h1>
    <p class="muted">Gates awaiting a human decision. You can act on gates your role is authorized for.</p>
    @if (error()) { <ion-text color="danger"><p>{{ error() }}</p></ion-text> }
    @if (gates().length === 0) { <ion-note color="medium">Nothing awaiting approval.</ion-note> }
    <ion-list>
      @for (g of gates(); track g.id) {
        <ion-item lines="full">
          <ion-label>
            <h3>{{ g.name }}</h3>
            <p class="muted">Stage: {{ g.lifecycleStage }} · Requires: {{ g.requiredRole }}</p>
          </ion-label>
          <div slot="end" style="display:flex;gap:4px;">
            <ion-button size="small" color="success" (click)="decide(g, 'approve')">Approve</ion-button>
            <ion-button size="small" color="warning" (click)="decide(g, 'request-changes')">Changes</ion-button>
            <ion-button size="small" color="danger" (click)="decide(g, 'reject')">Reject</ion-button>
            <ion-button size="small" fill="clear" [routerLink]="['/projects', g.projectId]">Open</ion-button>
          </div>
        </ion-item>
      }
    </ion-list>
  `,
})
export class ApprovalsPage implements OnInit {
  gates = signal<ApprovalGate[]>([]);
  error = signal<string | null>(null);
  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.gates.set(await this.api.listPendingApprovals());
  }

  async decide(gate: ApprovalGate, decision: string): Promise<void> {
    this.error.set(null);
    try {
      await this.api.decide(gate.id, { decision });
      await this.reload();
    } catch (err) {
      const e = err as { error?: { error?: string }; message?: string };
      this.error.set(e.error?.error ?? e.message ?? 'Decision failed.');
    }
  }
}
