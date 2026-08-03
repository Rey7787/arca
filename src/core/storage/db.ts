import Dexie, { type Table } from 'dexie';
import type { KdfId, KdfParams } from '@/core/crypto/kdf/KeyDerivation';

/** Envelope cifrado. Só id e profileId ficam em claro — nenhum dos dois vaza conteúdo. */
export interface EncryptedRecord {
  id: string;
  profileId: string;
  iv: Uint8Array;
  payload: Uint8Array;
  v: number; // versão do schema do dado lá dentro
}

/** Único registro NÃO cifrado. Nada aqui é secreto. */
export interface VaultMeta {
  id: string; // = profileId
  label: string; // rótulo escolhido, sem nome real
  kdfId: KdfId;
  kdfParams: KdfParams;
  salt: Uint8Array;
  wrappedMaster: Uint8Array;
  wrappedMasterIv: Uint8Array;
  recoverySalt: Uint8Array;
  wrappedMasterRecovery: Uint8Array;
  wrappedMasterRecoveryIv: Uint8Array;
  schemaVersion: number;
  createdAt: number;
  /** Minutos de inatividade até o bloqueio automático. Padrão: 30. */
  idleMinutes?: number;
}

export const CURRENT_SCHEMA_VERSION = 1;

class ArcaDatabase extends Dexie {
  meta!: Table<VaultMeta, string>;
  transactions!: Table<EncryptedRecord, string>;
  categories!: Table<EncryptedRecord, string>;
  plans!: Table<EncryptedRecord, string>;
  notes!: Table<EncryptedRecord, string>;

  constructor() {
    super('arca');
    // Índices só sobre campos em claro. Payload cifrado não é indexável —
    // é por isso que existe o índice em memória montado no unlock.
    this.version(1).stores({
      meta: 'id',
      transactions: 'id, profileId',
      categories: 'id, profileId',
      plans: 'id, profileId',
      notes: 'id, profileId',
    });
  }

  /** Módulo registrado depois acrescenta as próprias tabelas por aqui. */
  addModuleTables(version: number, stores: Record<string, string>): void {
    this.version(version).stores(stores);
  }
}

export const db = new ArcaDatabase();
