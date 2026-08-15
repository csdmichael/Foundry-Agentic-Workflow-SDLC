/**
 * Repository abstraction (DB tier). Business logic depends on this interface,
 * not on any concrete store. The factory selects a file-backed store for local
 * development or Cosmos DB when configured — see ./factory.ts.
 */
export interface Entity {
  id: string;
}

export interface Repository<T extends Entity> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  find(predicate: (item: T) => boolean): Promise<T[]>;
  upsert(item: T): Promise<T>;
  delete(id: string): Promise<boolean>;
}
