import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { WorkflowRun } from '../../models/models';
import { statusClass, statusLabel } from '../../shared/status.util';

@Component({
  selector: 'app-workflow-runs',
  standalone: true,
  imports: [CommonModule, RouterLink, IonIcon],
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <h1>Workflow Runs</h1>
        <p class="muted">Every Agent Framework run, with its current lifecycle stage and state.</p>
      </div>
    </header>

    <div class="panel">
      @if (loading()) {
        <div class="panel__body">
          <div class="skeleton-row" style="width: 60%"></div>
          <div class="skeleton-row" style="width: 45%"></div>
        </div>
      } @else if (runs().length === 0) {
        <div class="empty-state">
          <ion-icon name="git-network-outline" aria-hidden="true"></ion-icon>
          <h3>No workflow runs yet</h3>
          <p>Submitting a project creates a run and opens its nine approval gates.</p>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Current stage</th>
                <th scope="col" class="num">Stages</th>
                <th scope="col">Created</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (r of runs(); track r.id) {
                <tr class="is-clickable" [routerLink]="['/projects', r.projectId]">
                  <td><span class="cell-primary mono">{{ r.id.slice(0, 8) }}</span></td>
                  <td style="text-transform: capitalize">{{ r.currentStage }}</td>
                  <td class="num">{{ r.stages.length }}</td>
                  <td>{{ r.createdAt | date: 'medium' }}</td>
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
export class WorkflowRunsPage implements OnInit {
  runs = signal<WorkflowRun[]>([]);
  loading = signal(true);

  readonly statusClass = statusClass;
  readonly statusLabel = statusLabel;

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.runs.set(await this.api.listWorkflowRuns());
    } finally {
      this.loading.set(false);
    }
  }
}
