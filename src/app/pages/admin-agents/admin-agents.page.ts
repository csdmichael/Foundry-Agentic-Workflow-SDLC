import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput,
  IonToggle, IonChip, IonBadge, IonButton, IonText, IonAccordion, IonAccordionGroup,
} from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { AgentDefinition } from '../../models/models';

/** Agent & model configuration. Model deployment, route, temperature, token
 *  limits, approval requirement, and enablement are editable and persisted. */
@Component({
  selector: 'app-admin-agents',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput,
    IonToggle, IonChip, IonBadge, IonButton, IonText, IonAccordion, IonAccordionGroup,
  ],
  templateUrl: './admin-agents.page.html',
})
export class AdminAgentsPage implements OnInit {
  agents = signal<AgentDefinition[]>([]);
  error = signal<string | null>(null);
  saved = signal<string | null>(null);

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    this.agents.set(await this.api.listAgents());
  }

  async save(agent: AgentDefinition): Promise<void> {
    this.error.set(null);
    this.saved.set(null);
    try {
      await this.api.updateAgent(agent.agentId, {
        modelDeploymentName: agent.modelDeploymentName,
        apimRoute: agent.apimRoute,
        temperature: Number(agent.temperature),
        maxInputTokens: Number(agent.maxInputTokens),
        maxOutputTokens: Number(agent.maxOutputTokens),
        requiresHumanApproval: agent.requiresHumanApproval,
        enabled: agent.enabled,
      });
      this.saved.set(agent.agentId);
    } catch (err) {
      const e = err as { error?: { error?: string }; message?: string };
      this.error.set(e.error?.error ?? e.message ?? 'Save failed.');
    }
  }
}
