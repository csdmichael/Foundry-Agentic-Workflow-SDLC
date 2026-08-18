import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { AgentRun } from '../../models/models';
import { statusClass, statusLabel } from '../../shared/status.util';

@Component({
  selector: 'app-agent-activity',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <h1>Agent Activity</h1>
        <p class="muted">
          Every agent run with its model, APIM route, token estimate, guardrail findings, and correlation ID.
        </p>
      </div>
    </header>

    <div class="panel">
      @if (loading()) {
        <div class="panel__body">
          <div class="skeleton-row" style="width: 66%"></div>
          <div class="skeleton-row" style="width: 50%"></div>
        </div>
      } @else if (runs().length === 0) {
        <div class="empty-state">
          <ion-icon name="pulse-outline" aria-hidden="true"></ion-icon>
          <h3>No agent activity yet</h3>
          <p>Agent runs appear here once an approved stage invokes a Foundry agent through APIM.</p>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Agent</th>
                <th scope="col">Model &amp; route</th>
                <th scope="col" class="num">Tokens</th>
                <th scope="col">Guardrails</th>
                <th scope="col">Started</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (r of runs(); track r.id) {
                <tr>
                  <td>
                    <span class="cell-primary">{{ r.agentId }}</span>
                    <span class="cell-sub">{{ r.summary || 'No summary' }}</span>
                  </td>
                  <td>
                    {{ r.modelName }}
                    <span class="cell-sub mono">{{ r.apimRoute }}</span>
                  </td>
                  <td class="num">{{ r.tokenEstimate }}</td>
                  <td>
                    @if (r.guardrailFindings.length > 0) {
                      <span class="pill pill--danger">{{ r.guardrailFindings.length }} finding(s)</span>
                    } @else {
                      <span class="pill pill--success">Clean</span>
                    }
                  </td>
                  <td>
                    {{ r.startedAt | date: 'short' }}
                    <span class="cell-sub mono">corr {{ r.correlationId.slice(0, 8) }}</span>
                  </td>
                  <td><span [class]="statusClass(r.state)">{{ statusLabel(r.state) }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AgentActivityPage implements OnInit {
  runs = signal<AgentRun[]>([]);
  loading = signal(true);

  readonly statusClass = statusClass;
  readonly statusLabel = statusLabel;

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.runs.set(await this.api.listAgentRuns());
    } finally {
      this.loading.set(false);
    }
  }
}
