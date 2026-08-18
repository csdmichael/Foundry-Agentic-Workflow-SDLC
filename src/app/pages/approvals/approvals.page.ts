import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon, IonSpinner, IonTextarea } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ApprovalGate } from '../../models/models';
import { statusClass, statusLabel } from '../../shared/status.util';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonButton, IonIcon, IonSpinner, IonTextarea],
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <h1>Human Approval Queue</h1>
        <p class="muted">
          Gates awaiting a human decision. You can only act on gates your role is authorized for —
          the API re-checks every decision.
        </p>
      </div>
    </header>

    @if (error()) {
      <div class="alert alert--danger" role="alert">
        <ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>
        <p>{{ error() }}</p>
      </div>
    }

    <div class="panel">
      <div class="panel__header">
        <div>
          <h2>Pending gates</h2>
          <p class="muted">{{ gates().length }} awaiting a decision</p>
        </div>
      </div>

      @if (loading()) {
        <div class="panel__body">
          <div class="skeleton-row" style="width: 64%"></div>
          <div class="skeleton-row" style="width: 48%"></div>
        </div>
      } @else if (gates().length === 0) {
        <div class="empty-state">
          <ion-icon name="checkmark-done-outline" aria-hidden="true"></ion-icon>
          <h3>Queue is clear</h3>
          <p>Nothing is waiting on a human decision right now.</p>
        </div>
      } @else {
        <div class="panel__body">
          <ion-textarea
            [(ngModel)]="comment"
            [ngModelOptions]="{ standalone: true }"
            label="Decision comment (optional)"
            labelPlacement="stacked"
            placeholder="Recorded on the audit trail with your decision"
            autoGrow
            rows="2"
            fill="outline"
          ></ion-textarea>
        </div>

        <div class="panel__body panel__body--flush table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Gate</th>
                <th scope="col">Stage</th>
                <th scope="col">Required role</th>
                <th scope="col">Status</th>
                <th scope="col" class="cell-actions">Decision</th>
              </tr>
            </thead>
            <tbody>
              @for (g of gates(); track g.id) {
                <tr>
                  <td>
                    <span class="cell-primary">{{ g.name }}</span>
                    <span class="cell-sub">Project {{ g.projectId.slice(0, 8) }}</span>
                  </td>
                  <td style="text-transform: capitalize">{{ g.lifecycleStage }}</td>
                  <td>{{ g.requiredRole }}</td>
                  <td><span [class]="statusClass(g.state)">{{ statusLabel(g.state) }}</span></td>
                  <td class="cell-actions">
                    @if (busy() === g.id) {
                      <ion-spinner name="dots"></ion-spinner>
                    } @else {
                      <div class="decision-actions">
                        <ion-button size="small" color="success" (click)="decide(g, 'approve')">Approve</ion-button>
                        <ion-button size="small" color="warning" fill="outline" (click)="decide(g, 'request-changes')">
                          Changes
                        </ion-button>
                        <ion-button size="small" color="danger" fill="outline" (click)="decide(g, 'reject')">
                          Reject
                        </ion-button>
                        <ion-button size="small" fill="clear" [routerLink]="['/projects', g.projectId]">Open</ion-button>
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .decision-actions { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  `],
})
export class ApprovalsPage implements OnInit {
  gates = signal<ApprovalGate[]>([]);
  error = signal<string | null>(null);
  loading = signal(true);
  busy = signal<string | null>(null);
  comment = '';

  readonly statusClass = statusClass;
  readonly statusLabel = statusLabel;

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.reload();
    } finally {
      this.loading.set(false);
    }
  }

  private async reload(): Promise<void> {
    this.gates.set(await this.api.listPendingApprovals());
  }

  async decide(gate: ApprovalGate, decision: string): Promise<void> {
    this.error.set(null);
    this.busy.set(gate.id);
    try {
      await this.api.decide(gate.id, { decision, comments: this.comment });
      this.comment = '';
      await this.reload();
    } catch (err) {
      const e = err as { error?: { error?: string }; message?: string };
      this.error.set(e.error?.error ?? e.message ?? 'Decision failed.');
    } finally {
      this.busy.set(null);
    }
  }
}
