import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { uiConfig } from '../config/ui.config';
import {
  AgentDefinition,
  AgentRun,
  ApprovalGate,
  AuditLog,
  Project,
  ProjectDetail,
  User,
  WorkflowRun,
} from '../models/models';

/** Thin typed client over the API. Business logic stays server-side. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = uiConfig.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // Projects
  listProjects(): Promise<Project[]> {
    return firstValueFrom(this.http.get<Project[]>(`${this.base}/projects`));
  }
  getProject(id: string): Promise<ProjectDetail> {
    return firstValueFrom(this.http.get<ProjectDetail>(`${this.base}/projects/${id}`));
  }
  createProject(body: Partial<Project>): Promise<Project> {
    return firstValueFrom(this.http.post<Project>(`${this.base}/projects`, body));
  }
  submitProject(id: string): Promise<WorkflowRun> {
    return firstValueFrom(this.http.post<WorkflowRun>(`${this.base}/projects/${id}/submit`, {}));
  }
  archiveProject(id: string): Promise<Project> {
    return firstValueFrom(this.http.post<Project>(`${this.base}/projects/${id}/archive`, {}));
  }
  runAgent(projectId: string, agentId: string, prompt: string): Promise<AgentRun> {
    return firstValueFrom(
      this.http.post<AgentRun>(`${this.base}/projects/${projectId}/agents/${agentId}/run`, { prompt }),
    );
  }

  // Workflow runs
  listWorkflowRuns(): Promise<WorkflowRun[]> {
    return firstValueFrom(this.http.get<WorkflowRun[]>(`${this.base}/config/workflow-runs`));
  }

  // Agents
  listAgents(): Promise<AgentDefinition[]> {
    return firstValueFrom(this.http.get<AgentDefinition[]>(`${this.base}/agents`));
  }
  updateAgent(agentId: string, patch: Partial<AgentDefinition>): Promise<AgentDefinition> {
    return firstValueFrom(this.http.patch<AgentDefinition>(`${this.base}/agents/${agentId}`, patch));
  }
  listAgentRuns(workflowRunId?: string): Promise<AgentRun[]> {
    const q = workflowRunId ? `?workflowRunId=${workflowRunId}` : '';
    return firstValueFrom(this.http.get<AgentRun[]>(`${this.base}/agents/runs${q}`));
  }

  // Approvals
  listPendingApprovals(): Promise<ApprovalGate[]> {
    return firstValueFrom(this.http.get<ApprovalGate[]>(`${this.base}/approvals/pending`));
  }
  decide(gateId: string, body: { decision: string; comments?: string; delegatedTo?: string }): Promise<ApprovalGate> {
    return firstValueFrom(this.http.post<ApprovalGate>(`${this.base}/approvals/${gateId}/decision`, body));
  }

  // Audit
  listAudit(limit = 200): Promise<AuditLog[]> {
    return firstValueFrom(this.http.get<AuditLog[]>(`${this.base}/audit?limit=${limit}`));
  }

  // Users
  listUsers(): Promise<User[]> {
    return firstValueFrom(this.http.get<User[]>(`${this.base}/users`));
  }
  upsertUser(body: Partial<User>): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${this.base}/users`, body));
  }
  deleteUser(id: string): Promise<{ removed: boolean }> {
    return firstValueFrom(this.http.delete<{ removed: boolean }>(`${this.base}/users/${id}`));
  }

  // Config
  getConfig(): Promise<Record<string, unknown>> {
    return firstValueFrom(this.http.get<Record<string, unknown>>(`${this.base}/config`));
  }
}
