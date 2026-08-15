import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonList, IonItem, IonLabel, IonBadge, IonButton, IonIcon, IonSearchbar, IonNote,
} from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/models';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    IonList, IonItem, IonLabel, IonBadge, IonButton, IonIcon, IonSearchbar, IonNote,
  ],
  template: `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
      <h1>Existing Projects</h1>
      <ion-button routerLink="/projects/new"><ion-icon slot="start" name="add-outline"></ion-icon>New</ion-button>
    </div>
    <ion-searchbar (ionInput)="filter($event)" placeholder="Search projects"></ion-searchbar>
    @if (visible().length === 0) {
      <ion-note color="medium">No projects match.</ion-note>
    }
    <ion-list>
      @for (p of visible(); track p.id) {
        <ion-item [routerLink]="['/projects', p.id]" button detail>
          <ion-label>
            <h3>{{ p.name }}</h3>
            <p class="muted">{{ p.description || 'No description' }}</p>
            <p class="muted">Stage: {{ p.currentStage }} · Env: {{ p.targetEnvironment }} · {{ p.businessOwner }}</p>
          </ion-label>
          <ion-badge slot="end" [color]="badgeColor(p.state)">{{ p.state }}</ion-badge>
        </ion-item>
      }
    </ion-list>
  `,
})
export class ProjectsPage implements OnInit {
  private all = signal<Project[]>([]);
  visible = signal<Project[]>([]);

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    const projects = await this.api.listProjects();
    this.all.set(projects);
    this.visible.set(projects);
  }

  filter(event: CustomEvent): void {
    const q = String((event.detail as { value?: string }).value ?? '').toLowerCase();
    this.visible.set(this.all().filter((p) => p.name.toLowerCase().includes(q)));
  }

  badgeColor(state: string): string {
    if (state === 'Approved' || state === 'Completed') return 'success';
    if (state === 'Rejected' || state === 'Failed' || state === 'Blocked') return 'danger';
    if (state === 'AwaitingApproval' || state === 'ChangesRequested') return 'warning';
    return 'medium';
  }
}
