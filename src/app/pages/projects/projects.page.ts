import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon, IonSearchbar, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/models';
import { statusClass, statusLabel } from '../../shared/status.util';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, RouterLink, IonButton, IonIcon, IonSearchbar, IonSelect, IonSelectOption],
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <h1>Existing Projects</h1>
        <p class="muted">{{ all().length }} project(s) · {{ visible().length }} shown</p>
      </div>
      <div class="page-header__actions">
        <ion-button routerLink="/projects/new" size="small">
          <ion-icon slot="start" name="add-outline" aria-hidden="true"></ion-icon>
          New project
        </ion-button>
      </div>
    </header>

    <div class="panel">
      <div class="panel__header">
        <ion-searchbar
          class="projects__search"
          (ionInput)="setQuery($event)"
          placeholder="Search by name, owner, or description"
          [debounce]="150"
        ></ion-searchbar>
        <ion-select
          [value]="stateFilter()"
          (ionChange)="setState($event)"
          interface="popover"
          label="Status"
          labelPlacement="stacked"
          class="projects__filter"
        >
          <ion-select-option value="">All statuses</ion-select-option>
          @for (s of states(); track s) {
            <ion-select-option [value]="s">{{ statusLabel(s) }}</ion-select-option>
          }
        </ion-select>
      </div>

      @if (loading()) {
        <div class="panel__body">
          <div class="skeleton-row" style="width: 68%"></div>
          <div class="skeleton-row" style="width: 54%"></div>
          <div class="skeleton-row" style="width: 61%"></div>
        </div>
      } @else if (all().length === 0) {
        <div class="empty-state">
          <ion-icon name="folder-open-outline" aria-hidden="true"></ion-icon>
          <h3>No projects yet</h3>
          <p>Start the intake wizard to capture requirements and open the Plan &amp; Scope gate.</p>
          <ion-button routerLink="/projects/new" size="small">Create a project</ion-button>
        </div>
      } @else if (visible().length === 0) {
        <div class="empty-state">
          <ion-icon name="search-outline" aria-hidden="true"></ion-icon>
          <h3>No matches</h3>
          <p>No project matches the current search and status filter.</p>
          <ion-button fill="outline" size="small" (click)="clearFilters()">Clear filters</ion-button>
        </div>
      } @else {
        <div class="panel__body panel__body--flush table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Stage</th>
                <th scope="col">Environment</th>
                <th scope="col">Business owner</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (p of visible(); track p.id) {
                <tr class="is-clickable" [routerLink]="['/projects', p.id]">
                  <td>
                    <span class="cell-primary">{{ p.name }}</span>
                    <span class="cell-sub">{{ p.description || 'No description' }}</span>
                  </td>
                  <td style="text-transform: capitalize">{{ p.currentStage }}</td>
                  <td>{{ p.targetEnvironment }}</td>
                  <td>{{ p.businessOwner || '—' }}</td>
                  <td><span [class]="statusClass(p.state)">{{ statusLabel(p.state) }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .panel__header { flex-wrap: wrap; }
    .projects__search { flex: 1 1 260px; min-width: 200px; }
    .projects__filter { flex: 0 0 180px; max-width: 180px; }
  `],
})
export class ProjectsPage implements OnInit {
  readonly all = signal<Project[]>([]);
  readonly query = signal('');
  readonly stateFilter = signal('');
  readonly loading = signal(true);

  readonly statusClass = statusClass;
  readonly statusLabel = statusLabel;

  readonly states = computed(() => [...new Set(this.all().map((p) => p.state))].sort());

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const state = this.stateFilter();
    return this.all().filter((p) => {
      const matchesState = !state || p.state === state;
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.businessOwner.toLowerCase().includes(q);
      return matchesState && matchesQuery;
    });
  });

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.all.set(await this.api.listProjects());
    } finally {
      this.loading.set(false);
    }
  }

  setQuery(event: CustomEvent): void {
    this.query.set(String((event.detail as { value?: string }).value ?? ''));
  }

  setState(event: CustomEvent): void {
    this.stateFilter.set(String((event.detail as { value?: string }).value ?? ''));
  }

  clearFilters(): void {
    this.query.set('');
    this.stateFilter.set('');
  }
}
