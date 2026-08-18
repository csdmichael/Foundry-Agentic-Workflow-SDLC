import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonSearchbar } from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { AuditLog } from '../../models/models';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, IonIcon, IonSearchbar],
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <h1>Audit Trail</h1>
        <p class="muted">Append-only record of user actions, agent actions, and approval decisions.</p>
      </div>
    </header>

    <div class="panel">
      <div class="panel__header">
        <ion-searchbar
          style="flex: 1 1 auto"
          (ionInput)="setQuery($event)"
          placeholder="Filter by action, actor, or target"
          [debounce]="150"
        ></ion-searchbar>
        <span class="muted">{{ visible().length }} of {{ logs().length }}</span>
      </div>

      @if (loading()) {
        <div class="panel__body">
          <div class="skeleton-row" style="width: 72%"></div>
          <div class="skeleton-row" style="width: 58%"></div>
        </div>
      } @else if (visible().length === 0) {
        <div class="empty-state">
          <ion-icon name="receipt-outline" aria-hidden="true"></ion-icon>
          <h3>{{ logs().length === 0 ? 'No audit entries yet' : 'No matching entries' }}</h3>
          <p>
            {{
              logs().length === 0
                ? 'Every user action, agent action, and approval decision is recorded here.'
                : 'Try a different search term.'
            }}
          </p>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">When</th>
                <th scope="col">Correlation</th>
              </tr>
            </thead>
            <tbody>
              @for (log of visible(); track log.id) {
                <tr>
                  <td>
                    <span [class]="actorClass(log.actorType)">{{ log.actorType }}</span>
                    <span class="cell-sub">{{ log.actor }}</span>
                  </td>
                  <td><span class="cell-primary">{{ log.action }}</span></td>
                  <td>
                    {{ log.targetType }}
                    <span class="cell-sub mono">{{ log.targetId.slice(0, 12) }}</span>
                  </td>
                  <td>{{ log.timestamp | date: 'medium' }}</td>
                  <td class="mono">{{ log.correlationId ? log.correlationId.slice(0, 8) : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AuditPage implements OnInit {
  logs = signal<AuditLog[]>([]);
  query = signal('');
  loading = signal(true);

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.logs();
    return this.logs().filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q) ||
        l.targetType.toLowerCase().includes(q) ||
        l.targetId.toLowerCase().includes(q),
    );
  });

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.logs.set(await this.api.listAudit());
    } finally {
      this.loading.set(false);
    }
  }

  setQuery(event: CustomEvent): void {
    this.query.set(String((event.detail as { value?: string }).value ?? ''));
  }

  actorClass(actorType: string): string {
    if (actorType === 'agent') return 'pill pill--running';
    if (actorType === 'system') return 'pill pill--neutral';
    return 'pill pill--info';
  }
}
