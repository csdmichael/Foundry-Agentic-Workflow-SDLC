import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

/** Read-only view of non-secret config (APIM, integrations, guardrails). */
@Component({
  selector: 'app-admin-config',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <h1>APIM &amp; Configuration</h1>
        <p class="muted">
          Read-only view of non-secret configuration. Secrets are never returned by the API —
          values come from each tier's config folder.
        </p>
      </div>
    </header>

    @if (cfg(); as c) {
      <div class="panel">
        <div class="panel__header"><h2>APIM gateway</h2></div>
        <div class="panel__body"><pre>{{ pretty(c['apim']) }}</pre></div>
      </div>
      <div class="panel">
        <div class="panel__header"><h2>Integrations</h2></div>
        <div class="panel__body"><pre>{{ pretty(c['integrations']) }}</pre></div>
      </div>
      <div class="panel">
        <div class="panel__header"><h2>Guardrails</h2></div>
        <div class="panel__body"><pre>{{ pretty(c['guardrails']) }}</pre></div>
      </div>
    } @else {
      <div class="panel">
        <div class="panel__body">
          <div class="skeleton-row" style="width: 60%"></div>
          <div class="skeleton-row" style="width: 45%"></div>
        </div>
      </div>
    }
  `,
  styles: [`
    pre {
      white-space: pre-wrap;
      font-family: 'Cascadia Mono', ui-monospace, Consolas, monospace;
      font-size: 0.78rem;
      line-height: 1.55;
      background: var(--app-surface-alt);
      border: 1px solid var(--app-border);
      padding: var(--sp-3);
      border-radius: var(--radius-sm);
      margin: 0;
      overflow-x: auto;
    }
  `],
})
export class AdminConfigPage implements OnInit {
  cfg = signal<Record<string, unknown> | null>(null);
  constructor(private api: ApiService) {}
  async ngOnInit(): Promise<void> {
    this.cfg.set(await this.api.getConfig());
  }
  pretty(v: unknown): string {
    return JSON.stringify(v, null, 2);
  }
}
