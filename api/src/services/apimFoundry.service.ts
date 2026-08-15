/**
 * APIM → Foundry gateway client. ALL Foundry calls must route through APIM.
 * Direct Foundry calls are only permitted when FOUNDRY_ALLOW_DIRECT=1 in local
 * dev. Every call logs the configured auditable fields (prompt/agent/model/
 * token/project/user/gate/run/correlation IDs).
 *
 * This client returns a deterministic mock completion unless a live APIM
 * subscription key is configured, so the app runs end-to-end without cloud
 * credentials.
 */
import { config } from '../config';
import { AgentDefinition } from '../models';

export interface FoundryCallContext {
  promptId: string;
  agentId: string;
  modelName: string;
  projectId: string;
  userId: string;
  approvalGateId?: string;
  workflowRunId: string;
  correlationId: string;
}

export interface FoundryCallResult {
  content: string;
  tokenEstimate: number;
  route: string;
  viaApim: boolean;
  mocked: boolean;
}

export async function callFoundry(
  agent: AgentDefinition,
  prompt: string,
  ctx: FoundryCallContext,
): Promise<FoundryCallResult> {
  const gateway = config.apim.gateway;
  const route = agent.apimRoute;
  const tokenEstimate = estimateTokens(prompt) + 200;

  logCall(ctx, tokenEstimate, route);

  const hasApimKey = Boolean(config.secrets.apimSubscriptionKey);
  const directAllowed = config.flags.foundryAllowDirect && config.apim.foundry.allowDirectInLocalDevOnly;

  if (!hasApimKey && !directAllowed) {
    // No credentials: return a deterministic mock so the workflow is testable.
    return {
      content: mockCompletion(agent, prompt),
      tokenEstimate,
      route,
      viaApim: true,
      mocked: true,
    };
  }

  const url = directAllowed && !hasApimKey
    ? `${config.apim.foundry.projectEndpoint}/${route}`
    : `${gateway.baseUrl}/${route}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [gateway.correlationIdHeader]: ctx.correlationId,
  };
  if (hasApimKey) headers[gateway.subscriptionKeyHeader] = config.secrets.apimSubscriptionKey;

  const body = JSON.stringify({
    model: agent.modelDeploymentName,
    temperature: agent.temperature,
    max_tokens: agent.maxOutputTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), gateway.timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
    if (!res.ok) {
      throw Object.assign(new Error(`Foundry call failed: ${res.status}`), { status: 502 });
    }
    const json = (await res.json()) as any;
    const content = json?.choices?.[0]?.message?.content ?? '';
    return { content, tokenEstimate, route, viaApim: !directAllowed || hasApimKey, mocked: false };
  } finally {
    clearTimeout(timer);
  }
}

function logCall(ctx: FoundryCallContext, tokenEstimate: number, route: string): void {
  const record: Record<string, unknown> = {};
  for (const field of config.apim.logging.capturedFields) {
    record[field] = (ctx as unknown as Record<string, unknown>)[field] ?? (field === 'tokenEstimate' ? tokenEstimate : undefined);
  }
  record.route = route;
  // eslint-disable-next-line no-console
  console.info('[foundry-call]', JSON.stringify(record));
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function mockCompletion(agent: AgentDefinition, prompt: string): string {
  const snippet = prompt.slice(0, 120).replace(/\s+/g, ' ');
  return (
    `[MOCK ${agent.displayName} @ ${agent.modelDeploymentName}] ` +
    `Processed request for stage "${agent.lifecycleStage}". Input summary: "${snippet}...". ` +
    `This is a deterministic mock response (no APIM credentials configured).`
  );
}
