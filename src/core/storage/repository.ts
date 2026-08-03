import type { Table } from 'dexie';
import { openJson, sealJson } from '@/core/crypto/cipher';
import { vault } from '@/core/crypto/vault';
import { CURRENT_SCHEMA_VERSION, type EncryptedRecord } from './db';

export interface Entity {
  id: string;
}

/**
 * Repositório genérico. É o único lugar do app que sabe que existe
 * criptografia — módulo nenhum enxerga envelope.
 */
export class Repository<T extends Entity> {
  constructor(
    private table: Table<EncryptedRecord, string>,
    private profileId: string,
  ) {}

  async put(entity: T): Promise<void> {
    const sealed = await sealJson(vault.key(), entity);
    await this.table.put({
      id: entity.id,
      profileId: this.profileId,
      iv: sealed.iv,
      payload: sealed.payload,
      v: CURRENT_SCHEMA_VERSION,
    });
  }

  async putMany(entities: T[]): Promise<void> {
    const records = await Promise.all(
      entities.map(async (entity) => {
        const sealed = await sealJson(vault.key(), entity);
        return {
          id: entity.id,
          profileId: this.profileId,
          iv: sealed.iv,
          payload: sealed.payload,
          v: CURRENT_SCHEMA_VERSION,
        };
      }),
    );
    await this.table.bulkPut(records);
  }

  async get(id: string): Promise<T | undefined> {
    const record = await this.table.get(id);
    if (!record || record.profileId !== this.profileId) return undefined;
    return openJson<T>(vault.key(), { iv: record.iv, payload: record.payload });
  }

  /** Usado no unlock para montar o índice em memória. */
  async all(): Promise<T[]> {
    const records = await this.table.where('profileId').equals(this.profileId).toArray();
    return Promise.all(
      records.map((r) => openJson<T>(vault.key(), { iv: r.iv, payload: r.payload })),
    );
  }

  /** Remoção física. O caminho normal do app é soft delete, não isto. */
  async hardDelete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async count(): Promise<number> {
    return this.table.where('profileId').equals(this.profileId).count();
  }
}
