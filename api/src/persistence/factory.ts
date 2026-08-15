/**
 * Repository factory (DB tier). Returns a file-backed store for local dev or a
 * Cosmos-backed store when the persistence provider is "cosmos". The Cosmos
 * client is loaded lazily via an optional dependency so local dev needs no
 * Azure packages installed.
 */
import { config } from '../config';
import { Entity, Repository } from './repository';
import { FileRepository } from './fileRepository';

export type CollectionName =
  | 'users'
  | 'projects'
  | 'workflowRuns'
  | 'agentRuns'
  | 'approvalGates'
  | 'artifacts'
  | 'adoWorkItems'
  | 'gitHubRepos'
  | 'pipelines'
  | 'auditLogs';

const cache = new Map<string, Repository<any>>();

export function getRepository<T extends Entity>(collection: CollectionName): Repository<T> {
  const existing = cache.get(collection);
  if (existing) return existing as Repository<T>;

  let repo: Repository<T>;
  if (config.persistence.provider === 'cosmos' && isCosmosConfigured()) {
    // Lazy require keeps @azure/cosmos optional for local/file-based dev.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('./cosmosRepository') as typeof import('./cosmosRepository');
    repo = new mod.CosmosRepository<T>(collection);
  } else {
    repo = new FileRepository<T>(config.persistence.file.dataRoot, collection);
  }
  cache.set(collection, repo);
  return repo;
}

function isCosmosConfigured(): boolean {
  return Boolean(config.secrets.cosmosEndpoint || config.secrets.cosmosConnectionString);
}
