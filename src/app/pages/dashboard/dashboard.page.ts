import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonIcon, IonButton } from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ApprovalGate, Project, WorkflowRun } from '../../models/models';
import { statusClass, statusLabel } from '../../shared/status.util';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IonIcon, IonButton],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage implements OnInit {
  projects = signal<Project[]>([]);
  runs = signal<WorkflowRun[]>([]);
  pending = signal<ApprovalGate[]>([]);
  loading = signal(true);
  readonly user = this.auth.user;

  readonly statusClass = statusClass;
  readonly statusLabel = statusLabel;

  constructor(private api: ApiService, private auth: AuthService) {}

  async ngOnInit(): Promise<void> {
    try {
      const [projects, runs] = await Promise.all([this.api.listProjects(), this.api.listWorkflowRuns()]);
      this.projects.set(projects);
      this.runs.set(runs);
      if (this.auth.hasCapability('projects.read')) {
        try {
          this.pending.set(await this.api.listPendingApprovals());
        } catch {
          this.pending.set([]);
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  activeProjects(): number {
    return this.projects().filter((p) => p.state !== 'Archived').length;
  }

  runningRuns(): number {
    return this.runs().filter((r) => r.state === 'Running').length;
  }

  firstName(): string {
    return this.user()?.name?.split(/\s+/)[0] ?? '';
  }
}
