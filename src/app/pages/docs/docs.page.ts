import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { IonCard, IonCardContent } from '@ionic/angular/standalone';

interface DocTopic { title: string; body: string[]; }

const DOCS: Record<string, DocTopic> = {
  overview: {
    title: 'Overview',
    body: [
      'The Agentic SDLC / Software Factory orchestrates specialized Azure AI Foundry agents across the software development lifecycle with explicit human decision gates.',
      'Agents execute repeatable work (drafting requirements, design, code, tests, pipelines) while humans remain accountable for intent, risk, and outcomes.',
    ],
  },
  architecture: {
    title: 'Architecture',
    body: [
      'Tiers: Angular/Ionic UI, Node/TypeScript API, configurable persistence (file for local dev, Cosmos DB in Azure), and an agent-orchestration tier.',
      'All Foundry calls route through Azure API Management (APIM). The backend never calls Foundry directly except in explicit local-dev mode.',
      'Configuration is separated by tier: UI config, API config, DB/persistence config, and agent config each live in their own config folder.',
    ],
  },
  hitl: {
    title: 'Human-in-the-loop model',
    body: [
      'Nine approval gates span the lifecycle: Plan & Scope, Architecture & Design, Backlog Generation, Code Generation, Pull Request, Security Review, Test Acceptance, Release & Deployment, and Operate & Improve.',
      'No agent advances a stage when requiresHumanApproval is true and approval is missing. This is enforced server-side, so bypassing the UI cannot bypass approvals.',
      'Every decision records approver, role, timestamp, decision, comments, previous/next state, and artifact references, and is written to the audit trail.',
    ],
  },
  agents: {
    title: 'Agent responsibilities',
    body: [
      'Requirements Agent — ingests requirements/UX mockups; drafts epics, features, stories, tasks, acceptance criteria, and risks.',
      'Architecture Advisor — produces design notes, threat-model placeholders, API contracts, and an implementation plan; publishes approved artifacts to SharePoint.',
      'Code Generation — opens branches and pull requests; never merges without human approval.',
      'Test Automation — generates unit/integration/security/UAT plans; QA/Admin approval required to accept results.',
      'DevOps / Release — generates pipelines and IaC; human approval required before provisioning or deployment; managed identity preferred.',
      'Security & Compliance — reviews work items, code, dependencies, and infra plans; blocks promotion when checks or approvals are missing.',
      'Knowledge Assistant — searches docs and prior decisions with citations.',
    ],
  },
  security: {
    title: 'Security & guardrails',
    body: [
      'No secrets in code. Secrets come from environment variables or managed identity.',
      'Guardrail policies run before and after agent output: content safety, PII redaction, and secret scanning. Blocking findings fail the run.',
      'Role checks are enforced on both the UI (hidden navigation) and the API (server-side authorization).',
      'Correlation IDs flow across UI, API, APIM, agent calls, and audit logs.',
    ],
  },
};

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, IonCard, IonCardContent],
  template: `
    <h1>{{ topic().title }}</h1>
    <ion-card>
      <ion-card-content>
        @for (para of topic().body; track para) { <p>{{ para }}</p> }
      </ion-card-content>
    </ion-card>
  `,
})
export class DocsPage {
  private topicKey = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('topic') ?? 'overview')),
    { initialValue: 'overview' },
  );
  topic = computed<DocTopic>(() => DOCS[this.topicKey()] ?? DOCS['overview']);

  constructor(private route: ActivatedRoute) {}
}
