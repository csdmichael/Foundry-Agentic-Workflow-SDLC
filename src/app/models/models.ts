/**
 * Shared UI domain models. Mirror the API models (api/src/models). Kept as a
 * separate copy so the UI has no compile-time dependency on the API package.
 */
export type UserRole = 'business_user' | 'it_user' | 'admin' | 'app_owner' | 'guest';
export type AuthProvider = 'entra-id' | 'email-otp';

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  provider: AuthProvider;
  isInternal: boolean;
  tenantId?: string;
  role: UserRole;
}

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

export type LifecycleStage =
  | 'plan' | 'design' | 'build' | 'test' | 'deploy' | 'security' | 'operate' | 'improve';

export type WorkflowState =
  | 'Draft' | 'Submitted' | 'AwaitingApproval' | 'Approved' | 'Rejected'
  | 'ChangesRequested' | 'Running' | 'Completed' | 'Failed' | 'Blocked' | 'Archived';

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

export interface GuardrailFinding {
  policyId: string;
  phase: 'pre' | 'post';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  blocked: boolean;
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
  summary?: string;
  outputArtifactIds: string[];
  guardrailFindings: GuardrailFinding[];
  startedAt: string;
  completedAt?: string;
  startedBy: string;
}

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

export interface Artifact {
  id: string;
  projectId: string;
  kind: string;
  title: string;
  content: string;
  citations?: string[];
  createdAt: string;
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

export interface ProjectDetail {
  project: Project;
  run?: WorkflowRun;
  gates: ApprovalGate[];
  artifacts: Artifact[];
  agentRuns: AgentRun[];
}
