/**
 * Projects service. Manages project intake and the associated workflow run.
 * A new project starts in Draft; submission creates a workflow run and the
 * full set of approval gates (starting at Plan and Scope).
 */
import { v4 as uuid } from 'uuid';
import { getRepository } from '../persistence/factory';
import {
  AuthUser,
  LifecycleStage,
  Project,
  WorkflowRun,
  WorkflowStage,
} from '../models';
import { LIFECYCLE_ORDER, assertTransition } from './workflow.service';
import * as approvals from './approval.service';
import * as audit from './audit.service';

const projectRepo = () => getRepository<Project>('projects');
const runRepo = () => getRepository<WorkflowRun>('workflowRuns');

export interface CreateProjectInput {
  name: string;
  description: string;
  businessOwner: string;
  itOwner: string;
  sources: Project['sources'];
  adoOrganization: string;
  adoProject: string;
  gitHubRepo: string;
  targetEnvironment: Project['targetEnvironment'];
  selectedAgentIds: string[];
}

export async function create(input: CreateProjectInput, user: AuthUser, correlationId: string): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: uuid(),
    ...input,
    currentStage: 'plan',
    state: 'Draft',
    createdBy: user.email,
    createdAt: now,
    updatedAt: now,
  };
  await projectRepo().upsert(project);
  await audit.record({
    actorType: 'user',
    actor: user.email,
    action: 'project.create',
    targetType: 'project',
    targetId: project.id,
    correlationId,
    details: { name: project.name },
  });
  return project;
}

export async function list(): Promise<Project[]> {
  return (await projectRepo().getAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getById(id: string): Promise<Project | undefined> {
  return projectRepo().getById(id);
}

/** Submits a project for Plan and Scope approval, creating the workflow run. */
export async function submit(projectId: string, user: AuthUser, correlationId: string): Promise<WorkflowRun> {
  const project = await getById(projectId);
  if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });

  assertTransition(project.state, 'Submitted');
  project.state = 'AwaitingApproval';
  project.updatedAt = new Date().toISOString();
  await projectRepo().upsert(project);

  const stages: WorkflowStage[] = LIFECYCLE_ORDER.map((stage: LifecycleStage) => ({
    stage,
    state: stage === 'plan' ? 'AwaitingApproval' : 'Draft',
  }));
  const now = new Date().toISOString();
  const run: WorkflowRun = {
    id: uuid(),
    projectId,
    stages,
    currentStage: 'plan',
    state: 'AwaitingApproval',
    createdAt: now,
    updatedAt: now,
  };
  await runRepo().upsert(run);
  await approvals.createGatesForRun(run.id, projectId);

  await audit.record({
    actorType: 'user',
    actor: user.email,
    action: 'project.submit',
    targetType: 'project',
    targetId: projectId,
    correlationId,
    workflowRunId: run.id,
  });
  return run;
}

export async function getRun(runId: string): Promise<WorkflowRun | undefined> {
  return runRepo().getById(runId);
}

export async function getRunForProject(projectId: string): Promise<WorkflowRun | undefined> {
  const runs = await runRepo().find((r) => r.projectId === projectId);
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export async function listRuns(): Promise<WorkflowRun[]> {
  return (await runRepo().getAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveRun(run: WorkflowRun): Promise<WorkflowRun> {
  run.updatedAt = new Date().toISOString();
  return runRepo().upsert(run);
}

export async function archive(projectId: string, user: AuthUser, correlationId: string): Promise<Project> {
  const project = await getById(projectId);
  if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });
  assertTransition(project.state, 'Archived');
  project.state = 'Archived';
  project.updatedAt = new Date().toISOString();
  await projectRepo().upsert(project);
  await audit.record({
    actorType: 'user',
    actor: user.email,
    action: 'project.archive',
    targetType: 'project',
    targetId: projectId,
    correlationId,
  });
  return project;
}
