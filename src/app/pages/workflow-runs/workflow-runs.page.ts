import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonList, IonItem, IonLabel, IonBadge, IonNote } from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { WorkflowRun } from '../../models/models';

@Component({
  selector: 'app-workflow-runs',
  standalone: true,
  imports: [CommonModule, RouterLink, IonList, IonItem, IonLabel, IonBadge, IonNote],
  template: `
    <h1>Workflow Runs</h1>
    @if (runs().length === 0) { <ion-note color="medium">No workflow runs yet.</ion-note> }
    <ion-list>
      @for (r of runs(); track r.id) {
        <ion-item [routerLink]="['/projects', r.projectId]" button detail>
          <ion-label>
            <h3>Run {{ r.id.slice(0, 8) }}</h3>
            <p class="muted">Stage: {{ r.currentStage }} · {{ r.stages.length }} stages · {{ r.createdAt | date:'short' }}</p>
          </ion-label>
          <ion-badge slot="end">{{ r.state }}</ion-badge>
        </ion-item>
      }
    </ion-list>
  `,
})
export class WorkflowRunsPage implements OnInit {
  runs = signal<WorkflowRun[]>([]);
  constructor(private api: ApiService) {}
  async ngOnInit(): Promise<void> {
    this.runs.set(await this.api.listWorkflowRuns());
  }
}
