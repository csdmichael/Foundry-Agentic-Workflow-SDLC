import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonList, IonItem, IonLabel, IonBadge, IonChip, IonNote } from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { AgentRun } from '../../models/models';

@Component({
  selector: 'app-agent-activity',
  standalone: true,
  imports: [CommonModule, IonList, IonItem, IonLabel, IonBadge, IonChip, IonNote],
  template: `
    <h1>Agent Activity</h1>
    <p class="muted">All agent runs with model, token estimate, guardrail findings, and correlation ID.</p>
    @if (runs().length === 0) { <ion-note color="medium">No agent activity yet.</ion-note> }
    <ion-list>
      @for (r of runs(); track r.id) {
        <ion-item lines="full">
          <ion-label>
            <h3>{{ r.agentId }} <ion-chip [color]="color(r.state)">{{ r.state }}</ion-chip></h3>
            <p class="muted">{{ r.modelName }} via {{ r.apimRoute }} · tokens≈{{ r.tokenEstimate }}</p>
            <p class="muted">{{ r.summary }}</p>
            @if (r.guardrailFindings.length > 0) {
              <p><ion-chip color="danger">{{ r.guardrailFindings.length }} guardrail finding(s)</ion-chip></p>
            }
            <p class="muted">corr: {{ r.correlationId.slice(0, 8) }} · {{ r.startedAt | date:'short' }}</p>
          </ion-label>
        </ion-item>
      }
    </ion-list>
  `,
})
export class AgentActivityPage implements OnInit {
  runs = signal<AgentRun[]>([]);
  constructor(private api: ApiService) {}
  async ngOnInit(): Promise<void> {
    this.runs.set(await this.api.listAgentRuns());
  }
  color(state: string): string {
    if (state === 'Completed') return 'success';
    if (state === 'Blocked' || state === 'Failed') return 'danger';
    return 'medium';
  }
}
