import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonList, IonItem, IonLabel, IonChip, IonNote } from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { AuditLog } from '../../models/models';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, IonList, IonItem, IonLabel, IonChip, IonNote],
  template: `
    <h1>Audit Trail</h1>
    <p class="muted">Immutable record of user actions, agent actions, and approval decisions.</p>
    @if (logs().length === 0) { <ion-note color="medium">No audit entries yet.</ion-note> }
    <ion-list>
      @for (log of logs(); track log.id) {
        <ion-item lines="full">
          <ion-label>
            <h3>
              <ion-chip [color]="actorColor(log.actorType)">{{ log.actorType }}</ion-chip>
              {{ log.action }}
            </h3>
            <p class="muted">{{ log.actor }} → {{ log.targetType }}:{{ log.targetId.slice(0, 12) }}</p>
            <p class="muted">{{ log.timestamp | date:'medium' }}
              @if (log.correlationId) { · corr: {{ log.correlationId.slice(0, 8) }} }</p>
          </ion-label>
        </ion-item>
      }
    </ion-list>
  `,
})
export class AuditPage implements OnInit {
  logs = signal<AuditLog[]>([]);
  constructor(private api: ApiService) {}
  async ngOnInit(): Promise<void> {
    this.logs.set(await this.api.listAudit());
  }
  actorColor(t: string): string {
    if (t === 'agent') return 'tertiary';
    if (t === 'system') return 'medium';
    return 'primary';
  }
}
