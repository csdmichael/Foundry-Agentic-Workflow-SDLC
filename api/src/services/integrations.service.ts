/**
 * Integration connectors. Every connector defaults to a safe MOCK implementation
 * so the app runs end-to-end without live cloud credentials. Real implementations
 * should be added behind the same interface and toggled via
 * integrations.config.json (useMock: false). None of these perform a destructive
 * action without a corresponding approved gate (enforced by the orchestrator).
 */
import { v4 as uuid } from 'uuid';
import { config } from '../config';
import {
  AdoWorkItemMapping,
  GitHubRepoMapping,
  PipelineMapping,
} from '../models';

const ints = () => config.integrations;

// ---- Azure DevOps ----
export async function createBacklog(projectId: string, epics: string[]): Promise<AdoWorkItemMapping[]> {
  const useMock = ints().azureDevOps.useMock;
  const now = new Date().toISOString();
  return epics.map((title, i) => ({
    id: uuid(),
    projectId,
    workItemType: 'Epic' as const,
    title,
    externalId: useMock ? `MOCK-${1000 + i}` : `${1000 + i}`,
    createdAt: now,
  }));
}

// ---- GitHub ----
export async function createRepoAndPr(
  projectId: string,
  repoName: string,
): Promise<GitHubRepoMapping> {
  const gh = ints().github;
  const base = gh.useMock ? 'https://github.local/mock' : `https://github.com/${gh.org}`;
  return {
    id: uuid(),
    projectId,
    repoUrl: `${base}/${repoName}`,
    branch: 'feature/agent-generated',
    pullRequestUrl: `${base}/${repoName}/pull/1`,
    merged: false, // never auto-merge; requires human approval
    createdAt: new Date().toISOString(),
  };
}

// ---- Pipelines ----
export async function createPipeline(projectId: string, name: string): Promise<PipelineMapping> {
  const useMock = ints().azureDevOps.useMock;
  return {
    id: uuid(),
    projectId,
    pipelineName: name,
    pipelineUrl: useMock
      ? `https://dev.azure.com/mock/${name}`
      : `${ints().azureDevOps.organizationUrl}/_build?definitionId=${name}`,
    lastRunStatus: 'notStarted',
    createdAt: new Date().toISOString(),
  };
}

// ---- SharePoint publish ----
export async function publishToSharePoint(title: string): Promise<string> {
  const sp = ints().sharePoint;
  if (sp.useMock) return `https://sharepoint.local/mock/${encodeURIComponent(title)}`;
  return `${sp.siteUrl}/${encodeURIComponent(sp.designLibrary)}/${encodeURIComponent(title)}`;
}

// ---- Requirements source ingestion (SharePoint / OneDrive / local) ----
export async function readRequirements(kind: string, reference: string): Promise<string> {
  // Mock ingestion: returns a synthesized requirements blob referencing source.
  return `Requirements ingested from ${kind} (${reference}). [mock content]`;
}

// ---- Azure provisioning ----
export async function provisionAzure(projectId: string, env: string): Promise<{ status: string; details: string }> {
  const prov = ints().azureProvisioning;
  if (prov.useMock) {
    return { status: 'planned', details: `Mock provisioning plan for ${env} using ${prov.iacTemplatePath}` };
  }
  // TODO: implement real IaC deployment via managed identity. Never store secrets.
  return { status: 'planned', details: `IaC template ${prov.iacTemplatePath} ready for ${env}` };
}
