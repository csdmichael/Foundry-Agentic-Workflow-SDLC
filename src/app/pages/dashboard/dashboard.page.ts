import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonIcon, IonBadge, IonButton, IonList, IonItem, IonLabel,
} from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ApprovalGate, Project, WorkflowRun } from '../../models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonIcon, IonBadge, IonButton, IonList, IonItem, IonLabel,
  ],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage implements OnInit {
  projects = signal<Project[]>([]);
  runs = signal<WorkflowRun[]>([]);
  pending = signal<ApprovalGate[]>([]);
  readonly user = this.auth.user;

  constructor(private api: ApiService, private auth: AuthService) {}

  async ngOnInit(): Promise<void> {
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
  }

  activeProjects(): number {
    return this.projects().filter((p) => p.state !== 'Archived').length;
  }
}
