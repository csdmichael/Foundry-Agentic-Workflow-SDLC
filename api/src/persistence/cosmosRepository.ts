/**
 * Cosmos DB-backed repository (Azure). Loaded lazily by the factory only when
 * persistence.provider === "cosmos" and Cosmos is configured. Uses managed
 * identity (DefaultAzureCredential) when no connection string is provided.
 *
 * @azure/cosmos and @azure/identity are optional dependencies; this file is
 * only required at runtime when Cosmos is selected.
 */
import { config } from '../config';
import { Entity, Repository } from './repository';

// Types are intentionally loose to avoid a hard compile-time dependency on the
// optional @azure/cosmos package when building for file-based local dev.
/* eslint-disable @typescript-eslint/no-explicit-any */

export class CosmosRepository<T extends Entity> implements Repository<T> {
  private containerPromise: Promise<any>;

  constructor(private readonly collection: string) {
    this.containerPromise = this.init();
  }

  private async init(): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CosmosClient } = require('@azure/cosmos');
    const databaseId = config.secrets.cosmosDatabase || config.persistence.cosmos.database;
    let client: any;
    if (config.secrets.cosmosConnectionString) {
      client = new CosmosClient(config.secrets.cosmosConnectionString);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { DefaultAzureCredential } = require('@azure/identity');
      client = new CosmosClient({
        endpoint: config.secrets.cosmosEndpoint || config.persistence.cosmos.endpoint,
        aadCredentials: new DefaultAzureCredential(),
      });
    }
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    const pk =
      config.persistence.cosmos.containers[this.collection]?.partitionKey ?? '/id';
    const { container } = await database.containers.createIfNotExists({
      id: this.collection,
      partitionKey: { paths: [pk] },
    });
    return container;
  }

  async getAll(): Promise<T[]> {
    const container = await this.containerPromise;
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    return resources as T[];
  }

  async getById(id: string): Promise<T | undefined> {
    return (await this.getAll()).find((i) => i.id === id);
  }

  async find(predicate: (item: T) => boolean): Promise<T[]> {
    return (await this.getAll()).filter(predicate);
  }

  async upsert(item: T): Promise<T> {
    const container = await this.containerPromise;
    await container.items.upsert(item);
    return item;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    const container = await this.containerPromise;
    await container.item(id).delete();
    return true;
  }
}
