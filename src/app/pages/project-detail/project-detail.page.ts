import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonTextarea, IonSpinner,
  IonCheckbox, IonInput, IonSelect, IonSelectOption,
} from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { AgentDefinition, ApprovalGate, ProjectDetail, SystemOfRecordMap } from '../../models/models';
import { PROVIDER_LABELS } from '../../config/ui.config';
import { statusClass, statusLabel } from '../../shared/status.util';

/**
 * Project detail. Shows lifecycle stage, approval gates, backlog/artifacts,
 * repo/pipeline links, systems of record, and agent runs. Approval actions and
 * agent runs are gated by capabilities on the UI and re-checked server-side.
 */
@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonTextarea, IonSpinner,
    IonCheckbox, IonInput, IonSelect, IonSelectOption,
  ],
  templateUrl: './project-detail.page.html',
  styles: [`
    .decision-actions { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  `],
})
export class ProjectDetailPage implements OnInit {
  readonly stages = ['plan', 'design', 'build', 'test', 'security', 'deploy'];

  detail = signal<ProjectDetail | null>(null);
  agents = signal<AgentDefinition[]>([]);
  busy = signal<string | null>(null);
  error = signal<string | null>(null);
  comment = '';

  sorValues: SystemOfRecordMap = {};
  sorOverridden = new Set<string>();
  sorSaved = signal(false);

  readonly statusClass = statusClass;
  readonly statusLabel = statusLabel;

  readonly canApprove = this.auth.hasCapability.bind(this.auth);

  constructor(private route: ActivatedRoute, private api: ApiService, private auth: AuthService) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    await this.reload(id);
    this.agents.set(await this.api.listAgents());
  }

  private async reload(id: string): Promise<void> {
    const detail = await this.api.getProject(id);
    this.detail.set(detail);
    // Editors start from the effective values so an override begins where inheritance left off.
    this.sorValues = structuredClone(detail.systemsOfRecord.effective);
    this.sorOverridden = new Set(detail.systemsOfRecord.overriddenKeys);
  }

  providerLabel(provider: string): string {
    return PROVIDER_LABELS[provider] ?? provider;
  }

  toggleSorOverride(key: string, checked: boolean): void {
    if (checked) this.sorOverridden.add(key);
    else this.sorOverridden.delete(key);
    this.sorSaved.set(false);
  }

  async saveSystemsOfRecord(): Promise<void> {
    const project = this.detail()?.project;
    if (!project) return;
    this.error.set(null);
    this.sorSaved.set(false);
    this.busy.set('systems-of-record');
    try {
      const overrides: SystemOfRecordMap = {};
      this.sorOverridden.forEach((key) => {
        if (this.sorValues[key]) overrides[key] = this.sorValues[key];
      });
      await this.api.updateProjectSystemsOfRecord(project.id, overrides);
      await this.reload(project.id);
      this.sorSaved.set(true);
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(null);
    }
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

  private msg(err: unknown): string {
    const e = err as { error?: { error?: string }; message?: string };
    return e.error?.error ?? e.message ?? 'Action failed.';
  }
}
