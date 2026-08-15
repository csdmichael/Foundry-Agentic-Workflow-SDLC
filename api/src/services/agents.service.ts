/**
 * Agent definitions service. Reads the configurable agent catalog from the
 * agent-orchestration tier config and exposes lookup/list/update. Model,
 * route, tools, guardrails, and approval requirements are all data-driven.
 */
import { config } from '../config';
import { AgentDefinition } from '../models';

function withDefaults(raw: any): AgentDefinition {
  const d = config.agents.defaults ?? {};
  return {
    agentId: raw.agentId,
    displayName: raw.displayName,
    lifecycleStage: raw.lifecycleStage,
    modelDeploymentName: raw.modelDeploymentName,
    modelProvider: raw.modelProvider ?? d.modelProvider,
    apimRoute: raw.apimRoute,
    toolsAllowed: raw.toolsAllowed ?? [],
    mcpServersAllowed: raw.mcpServersAllowed ?? [],
    maxInputTokens: raw.maxInputTokens ?? d.maxInputTokens,
    maxOutputTokens: raw.maxOutputTokens ?? d.maxOutputTokens,
    temperature: raw.temperature ?? d.temperature,
    requiresHumanApproval: raw.requiresHumanApproval ?? true,
    approvalRole: raw.approvalRole ?? 'admin',
    guardrails: raw.guardrails ?? [],
    enabled: raw.enabled ?? true,
  };
}

// In-memory overrides layered over file config (persisted separately in prod).
const overrides = new Map<string, AgentDefinition>();

export function list(): AgentDefinition[] {
  return (config.agents.agents as any[]).map((a) => overrides.get(a.agentId) ?? withDefaults(a));
}

export function get(agentId: string): AgentDefinition | undefined {
  return list().find((a) => a.agentId === agentId);
}

export function update(agentId: string, patch: Partial<AgentDefinition>): AgentDefinition {
  const current = get(agentId);
  if (!current) throw Object.assign(new Error(`Unknown agent: ${agentId}`), { status: 404 });
  const next = { ...current, ...patch, agentId };
  overrides.set(agentId, next);
  return next;
}
