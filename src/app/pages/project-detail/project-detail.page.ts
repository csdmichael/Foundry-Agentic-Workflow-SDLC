import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonBadge, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonChip, IonTextarea, IonSpinner, IonText,
} from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { AgentDefinition, ApprovalGate, ProjectDetail } from '../../models/models';

/**
 * Project detail. Shows lifecycle stage, approval gates, backlog/artifacts,
 * repo/pipeline links, and agent runs. Approval actions and agent runs are
 * gated by capabilities on the UI and re-checked server-side.
 */
@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonBadge, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonChip, IonTextarea, IonSpinner, IonText,
  ],
  templateUrl: './project-detail.page.html',
})
export class ProjectDetailPage implements OnInit {
  detail = signal<ProjectDetail | null>(null);
  agents = signal<AgentDefinition[]>([]);
  busy = signal<string | null>(null);
  error = signal<string | null>(null);
  comment = '';

  readonly canApprove = this.auth.hasCapability.bind(this.auth);

  constructor(private route: ActivatedRoute, private api: ApiService, private auth: AuthService) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    await this.reload(id);
    this.agents.set(await this.api.listAgents());
  }

  private async reload(id: string): Promise<void> {
    this.detail.set(await this.api.getProject(id));
  }

  agentFor(stage: string): AgentDefinition | undefined {
    return this.agents().find((a) => a.lifecycleStage === stage && a.enabled);
  }

  async decide(gate: ApprovalGate, decision: string): Promise<void> {
    this.error.set(null);
    this.busy.set(gate.id);
    try {
      await this.api.decide(gate.id, { decision, comments: this.comment });
      this.comment = '';
      await this.reload(this.detail()!.project.id);
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(null);
    }
  }

  async runAgent(stage: string): Promise<void> {
    const agent = this.agentFor(stage);
    if (!agent) return;
    this.error.set(null);
    this.busy.set(agent.agentId);
    try {
      await this.api.runAgent(this.detail()!.project.id, agent.agentId, `Run ${agent.displayName} for ${stage}`);
      await this.reload(this.detail()!.project.id);
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(null);
    }
  }

  badgeColor(state: string): string {
    if (state === 'Approved' || state === 'Completed') return 'success';
    if (state === 'Rejected' || state === 'Failed' || state === 'Blocked') return 'danger';
    if (state === 'AwaitingApproval' || state === 'ChangesRequested') return 'warning';
    return 'medium';
  }

  private msg(err: unknown): string {
    const e = err as { error?: { error?: string }; message?: string };
    return e.error?.error ?? e.message ?? 'Action failed.';
  }
}
