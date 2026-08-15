/**
 * Shared domain models for the Agentic SDLC / Software Factory.
 * Strongly typed entities used across API tiers and mirrored in the UI.
 */

// ---- Identity & access ----
export type UserRole = 'business_user' | 'it_user' | 'admin' | 'app_owner';
export const ALL_ROLES: UserRole[] = ['business_user', 'it_user', 'admin', 'app_owner'];

export type AuthProvider = 'entra-id' | 'email-otp';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  provider: AuthProvider;
  authenticationMethod: 'Entra ID' | 'OTP';
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  provider: AuthProvider;
  isInternal: boolean;
  tenantId?: string;
  role: UserRole;
}

// ---- Lifecycle / workflow ----
export type LifecycleStage =
  | 'plan'
  | 'design'
  | 'build'
  | 'test'
  | 'deploy'
  | 'security'
  | 'operate'
  | 'improve';

export type WorkflowState =
  | 'Draft'
  | 'Submitted'
  | 'AwaitingApproval'
  | 'Approved'
  | 'Rejected'
  | 'ChangesRequested'
  | 'Running'
  | 'Completed'
  | 'Failed'
  | 'Blocked'
  | 'Archived';

export type TargetEnvironment = 'Dev' | 'Test' | 'UAT' | 'Prod';
export type RequirementSourceKind = 'sharepoint' | 'onedrive' | 'local-upload';

export interface ProjectSource {
  kind: RequirementSourceKind;
  reference: string;
  uploadedFiles?: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  businessOwner: string;
  itOwner: string;
  sources: ProjectSource[];
  adoOrganization: string;
  adoProject: string;
  gitHubRepo: string;
  targetEnvironment: TargetEnvironment;
  selectedAgentIds: string[];
  currentStage: LifecycleStage;
  state: WorkflowState;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStage {
  stage: LifecycleStage;
  state: WorkflowState;
  approvalGateId?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  stages: WorkflowStage[];
  currentStage: LifecycleStage;
  state: WorkflowState;
  createdAt: string;
  updatedAt: string;
}

// ---- Agents ----
export interface AgentDefinition {
  agentId: string;
  displayName: string;
  lifecycleStage: LifecycleStage;
  modelDeploymentName: string;
  modelProvider: string;
  apimRoute: string;
  toolsAllowed: string[];
  mcpServersAllowed: string[];
  maxInputTokens: number;
  maxOutputTokens: number;
  temperature: number;
  requiresHumanApproval: boolean;
  approvalRole: UserRole;
  guardrails: string[];
  enabled: boolean;
}

export interface AgentToolCall {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'succeeded' | 'failed' | 'blocked';
  at: string;
}

export interface AgentRun {
  id: string;
  workflowRunId: string;
  projectId: string;
  agentId: string;
  lifecycleStage: LifecycleStage;
  modelName: string;
  apimRoute: string;
  promptId: string;
  tokenEstimate: number;
  correlationId: string;
  state: WorkflowState;
  toolCalls: AgentToolCall[];
  summary?: string;
  outputArtifactIds: string[];
  guardrailFindings: GuardrailFinding[];
  startedAt: string;
  completedAt?: string;
  startedBy: string;
}

// ---- Approval gates ----
export type ApprovalDecisionType = 'approve' | 'reject' | 'request-changes' | 'delegate';

export interface ApprovalDecision {
  id: string;
  approver: string;
  approverRole: UserRole;
  decision: ApprovalDecisionType;
  comments?: string;
  delegatedTo?: string;
  timestamp: string;
  previousState: WorkflowState;
  nextState: WorkflowState;
  artifactRefs: string[];
}

export interface ApprovalGate {
  id: string;
  workflowRunId: string;
  projectId: string;
  lifecycleStage: LifecycleStage;
  name: string;
  requiredRole: UserRole;
  state: WorkflowState;
  requiresHumanApproval: boolean;
  decisions: ApprovalDecision[];
  artifactRefs: string[];
  createdAt: string;
  updatedAt: string;
}

// ---- Artifacts & integration mappings ----
export type ArtifactKind =
  | 'requirements-summary'
  | 'backlog'
  | 'architecture'
  | 'threat-model'
  | 'api-contract'
  | 'code-pr'
  | 'test-plan'
  | 'pipeline'
  | 'security-findings'
  | 'iac';

export interface Artifact {
  id: string;
  projectId: string;
  workflowRunId?: string;
  agentRunId?: string;
  kind: ArtifactKind;
  title: string;
  content: string;
  citations?: string[];
  createdAt: string;
}

export interface AdoWorkItemMapping {
  id: string;
  projectId: string;
  workItemType: 'Epic' | 'Feature' | 'UserStory' | 'Task';
  title: string;
  externalId: string;
  parentExternalId?: string;
  acceptanceCriteria?: string;
  createdAt: string;
}

export interface GitHubRepoMapping {
  id: string;
  projectId: string;
  repoUrl: string;
  branch: string;
  pullRequestUrl?: string;
  merged: boolean;
  createdAt: string;
}

export interface PipelineMapping {
  id: string;
  projectId: string;
  pipelineName: string;
  pipelineUrl: string;
  lastRunStatus?: string;
  createdAt: string;
}

// ---- Guardrails & audit ----
export type GuardrailPhase = 'pre' | 'post';
export type GuardrailSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface GuardrailPolicy {
  id: string;
  name: string;
  description: string;
  appliesTo: GuardrailPhase[];
  action: 'block' | 'redact' | 'warn';
  severityThreshold?: GuardrailSeverity;
  enabled: boolean;
}

export interface GuardrailFinding {
  policyId: string;
  phase: GuardrailPhase;
  severity: GuardrailSeverity;
  message: string;
  blocked: boolean;
}

export interface AuditLog {
  id: string;
  day: string;
  timestamp: string;
  actorType: 'user' | 'agent' | 'system';
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  correlationId?: string;
  workflowRunId?: string;
  approvalGateId?: string;
  details?: Record<string, unknown>;
}

export interface AppConfiguration {
  key: string;
  value: unknown;
  scope: 'ui' | 'api' | 'db' | 'agent' | 'integration';
  updatedBy: string;
  updatedAt: string;
}
