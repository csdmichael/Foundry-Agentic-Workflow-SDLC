/**
 * File-backed repository for local development. Stores one JSON file per
 * collection under the configured data root. Uses an in-process write lock
 * (single-instance dev only). Cosmos DB is used in Azure — see factory.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Entity, Repository } from './repository';

export class FileRepository<T extends Entity> implements Repository<T> {
  private readonly filePath: string;
  private writing = Promise.resolve();

  constructor(dataRoot: string, collection: string) {
    const dir = path.resolve(process.cwd(), dataRoot);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = path.join(dir, `${collection}.json`);
  }

  private read(): T[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  private write(items: T[]): void {
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  async getAll(): Promise<T[]> {
    return this.read();
  }

  async getById(id: string): Promise<T | undefined> {
    return this.read().find((i) => i.id === id);
  }

  async find(predicate: (item: T) => boolean): Promise<T[]> {
    return this.read().filter(predicate);
  }

  async upsert(item: T): Promise<T> {
    await (this.writing = this.writing.then(() => {
      const items = this.read();
      const idx = items.findIndex((i) => i.id === item.id);
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      this.write(items);
    }));
    return item;
  }

  async delete(id: string): Promise<boolean> {
    let removed = false;
    await (this.writing = this.writing.then(() => {
      const items = this.read();
      const next = items.filter((i) => i.id !== id);
      removed = next.length !== items.length;
      if (removed) this.write(next);
    }));
    return removed;
  }
}
