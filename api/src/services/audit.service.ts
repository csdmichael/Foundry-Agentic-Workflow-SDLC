/**
 * Audit service. Records every user action, agent action, and approval
 * decision. Append-only from the caller's perspective.
 */
import { v4 as uuid } from 'uuid';
import { getRepository } from '../persistence/factory';
import { AuditLog } from '../models';

const repo = () => getRepository<AuditLog>('auditLogs');

export interface AuditInput {
  actorType: AuditLog['actorType'];
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  correlationId?: string;
  workflowRunId?: string;
  approvalGateId?: string;
  details?: Record<string, unknown>;
}

export async function record(input: AuditInput): Promise<AuditLog> {
  const now = new Date();
  const entry: AuditLog = {
    id: uuid(),
    day: now.toISOString().slice(0, 10),
    timestamp: now.toISOString(),
    ...input,
  };
  return repo().upsert(entry);
}

export async function list(limit = 200): Promise<AuditLog[]> {
  const all = await repo().getAll();
  return all
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export async function listForWorkflowRun(workflowRunId: string): Promise<AuditLog[]> {
  const rows = await repo().find((r) => r.workflowRunId === workflowRunId);
  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
