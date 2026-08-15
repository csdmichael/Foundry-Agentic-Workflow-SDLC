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
import { AgentDefinition, ProjectSource, RequirementSourceKind, TargetEnvironment } from '../../models/models';

/**
 * New Project wizard. Collects intake details, requirement sources, ADO/GitHub
 * targets, environment, and the lifecycle agents to run. On submit it creates
 * the project (Draft) and submits it for Plan and Scope approval — no
 * downstream agent runs until that gate is approved.
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
  readonly totalSteps = 5;
  saving = signal(false);
  error = signal<string | null>(null);

  agents = signal<AgentDefinition[]>([]);
  selectedAgents = new Set<string>();

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
    const agents = await this.api.listAgents();
    this.agents.set(agents.filter((a) => a.enabled));
    agents.filter((a) => a.enabled).forEach((a) => this.selectedAgents.add(a.agentId));
  }

  progress(): number {
    return this.step() / this.totalSteps;
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
