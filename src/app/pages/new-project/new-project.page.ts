import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput,
  IonTextarea, IonSelect, IonSelectOption, IonButton, IonCheckbox, IonList, IonNote,
  IonText, IonChip, IonProgressBar, IonIcon,
} from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import {
  AgentDefinition, ProjectSource, RequirementSourceKind, SystemOfRecordCatalogEntry,
  SystemOfRecordMap, TargetEnvironment,
} from '../../models/models';
import { PROVIDER_LABELS } from '../../config/ui.config';

const STEPS = [
  { title: 'Project details', hint: 'Who owns this work and what is it called.' },
  { title: 'Requirements & UX mockups', hint: 'Where the agents should read intake material from.' },
  { title: 'DevOps & repository', hint: 'Where backlog items, code, and deployments land.' },
  { title: 'Systems of Record', hint: 'Inherited from global settings; override only what differs.' },
  { title: 'Lifecycle agents', hint: 'Which specialized Foundry agents run for this project.' },
  { title: 'Confirm & submit', hint: 'Review, then open the Plan & Scope approval gate.' },
];

/**
 * New Project wizard. Collects intake details, requirement sources, ADO/GitHub
 * targets, environment, systems of record, and the lifecycle agents to run. On
 * submit it creates the project (Draft) and submits it for Plan and Scope
 * approval — no downstream agent runs until that gate is approved.
 */
@Component({
  selector: 'app-new-project',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput,
    IonTextarea, IonSelect, IonSelectOption, IonButton, IonCheckbox, IonList, IonNote,
    IonText, IonChip, IonProgressBar, IonIcon,
  ],
  templateUrl: './new-project.page.html',
})
export class NewProjectPage implements OnInit {
  step = signal(1);
  readonly totalSteps = 6;
  saving = signal(false);
  error = signal<string | null>(null);

  agents = signal<AgentDefinition[]>([]);
  selectedAgents = new Set<string>();

  sorCatalog = signal<SystemOfRecordCatalogEntry[]>([]);
  /** Pre-populated from global settings; only rows toggled on are sent as overrides. */
  sorValues: SystemOfRecordMap = {};
  sorOverridden = new Set<string>();

  readonly sourceKinds: { value: RequirementSourceKind; label: string }[] = [
    { value: 'sharepoint', label: 'SharePoint' },
    { value: 'onedrive', label: 'OneDrive' },
    { value: 'local-upload', label: 'Local disk upload' },
  ];
  readonly environments: TargetEnvironment[] = ['Dev', 'Test', 'UAT', 'Prod'];

  model = {
    name: '',
    description: '',
    businessOwner: '',
    itOwner: '',
    sourceKind: 'local-upload' as RequirementSourceKind,
    sourceReference: '',
    adoOrganization: '',
    adoProject: '',
    gitHubRepo: '',
    targetEnvironment: 'Dev' as TargetEnvironment,
  };

  constructor(private api: ApiService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    const [agents, defaults, sor] = await Promise.all([
      this.api.listAgents(),
      this.api.getProjectDefaults().catch(() => null),
      this.api.getSystemsOfRecord().catch(() => null),
    ]);
    const enabled = agents.filter((a) => a.enabled);
    this.agents.set(enabled);
    enabled.forEach((a) => this.selectedAgents.add(a.agentId));
    if (defaults) {
      this.model.adoOrganization = defaults.adoOrganization;
      this.model.adoProject = defaults.adoProject;
      this.model.gitHubRepo = defaults.gitHubOrg ? `${defaults.gitHubOrg}/` : '';
    }
    if (sor) {
      this.sorCatalog.set(sor.catalog);
      this.sorValues = structuredClone(sor.settings);
    }
  }

  providerLabel(provider: string): string {
    return PROVIDER_LABELS[provider] ?? provider;
  }

  toggleSorOverride(key: string, checked: boolean): void {
    if (checked) this.sorOverridden.add(key);
    else this.sorOverridden.delete(key);
  }

  progress(): number {
    return this.step() / this.totalSteps;
  }

  stepTitle(): string {
    return STEPS[this.step() - 1]?.title ?? '';
  }

  stepHint(): string {
    return STEPS[this.step() - 1]?.hint ?? '';
  }

  next(): void {
    if (this.step() < this.totalSteps) this.step.set(this.step() + 1);
  }
  prev(): void {
    if (this.step() > 1) this.step.set(this.step() - 1);
  }

  toggleAgent(id: string, checked: boolean): void {
    if (checked) this.selectedAgents.add(id);
    else this.selectedAgents.delete(id);
  }

  canContinue(): boolean {
    switch (this.step()) {
      case 1:
        return this.model.name.trim().length > 2 && this.model.businessOwner.trim().length > 0;
      case 2:
        return this.model.sourceReference.trim().length > 0 || this.model.sourceKind === 'local-upload';
      default:
        return true;
    }
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.saving.set(true);
    try {
      const sources: ProjectSource[] = [
        { kind: this.model.sourceKind, reference: this.model.sourceReference || '(local upload pending)' },
      ];
      const systemsOfRecord: SystemOfRecordMap = {};
      this.sorOverridden.forEach((key) => {
        if (this.sorValues[key]) systemsOfRecord[key] = this.sorValues[key];
      });
      const project = await this.api.createProject({
        name: this.model.name,
        description: this.model.description,
        businessOwner: this.model.businessOwner,
        itOwner: this.model.itOwner,
        sources,
        adoOrganization: this.model.adoOrganization,
        adoProject: this.model.adoProject,
        gitHubRepo: this.model.gitHubRepo,
        targetEnvironment: this.model.targetEnvironment,
        selectedAgentIds: Array.from(this.selectedAgents),
        systemsOfRecord,
      });
      // Submit for Plan and Scope approval immediately.
      await this.api.submitProject(project.id);
      this.router.navigate(['/projects', project.id]);
    } catch (err) {
      const e = err as { error?: { error?: string }; message?: string };
      this.error.set(e.error?.error ?? e.message ?? 'Failed to create project.');
    } finally {
      this.saving.set(false);
    }
  }
}
