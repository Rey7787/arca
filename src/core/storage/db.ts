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

/**
 * Versão do schema do IndexedDB conhecida por ESTE build.
 * Se o banco no disco estiver acima disto, o JavaScript rodando é velho —
 * ver AppDesatualizadoError abaixo.
 */
export const DEXIE_VERSION = 1;

/**
 * Erro sinalizando que o banco foi migrado por uma versão mais nova da Arca
 * e este código não sabe ler o que está lá dentro.
 *
 * Acontece quando o app é atualizado enquanto uma aba antiga continua aberta,
 * ou quando o service worker serve JavaScript velho depois de um deploy.
 * A resposta correta é SEMPRE recarregar — nunca tentar ler mesmo assim.
 */
export class AppDesatualizadoError extends Error {
  constructor() {
    super('O app foi atualizado. Recarregue a página.');
    this.name = 'AppDesatualizadoError';
  }
}

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
    this.version(DEXIE_VERSION).stores({
      meta: 'id',
      transactions: 'id, profileId',
      categories: 'id, profileId',
      plans: 'id, profileId',
      notes: 'id, profileId',
    });
  }

  /**
   * Módulo registrado depois acrescenta as próprias tabelas por aqui.
   *
   * TEM que ser chamado antes de abrirBanco(). Depois que o Dexie abre a
   * conexão, declarar versão nova lança erro — e, pior, o conjunto de módulos
   * registrados passa a definir a versão do banco: se ele variar entre dois
   * builds, um deles vira "app desatualizado" sem ninguém ter mexido no schema.
   */
  addModuleTables(version: number, stores: Record<string, string>): void {
    if (this.isOpen()) {
      throw new Error(
        `Módulo tentou declarar tabelas (v${version}) com o banco já aberto. ` +
          'Registre todos os módulos antes de abrirBanco().',
      );
    }
    if (version <= DEXIE_VERSION) {
      throw new Error(
        `Módulo declarou versão ${version}, que não é maior que DEXIE_VERSION (${DEXIE_VERSION}).`,
      );
    }
    this.version(version).stores(stores);
  }
}

export const db = new ArcaDatabase();

// ---------------------------------------------------------------------------
// Proteção contra versão descasada
// ---------------------------------------------------------------------------

let aoDesatualizar: (() => void) | null = null;
let jaSinalizou = false;

/** A interface registra aqui a tela de "recarregue o app". */
export function onAppDesatualizado(handler: () => void): void {
  aoDesatualizar = handler;
}

function sinalizarDesatualizado(): void {
  if (jaSinalizou) return;
  jaSinalizou = true;
  // Fechar a conexão é obrigatório: enquanto esta aba segurar o banco, a aba
  // que está tentando migrar fica presa em 'blocked' e trava as duas.
  try {
    db.close();
  } catch {
    /* já fechado */
  }
  aoDesatualizar?.();
}

// Outra aba (com versão mais nova) quer migrar o banco.
db.on('versionchange', () => {
  sinalizarDesatualizado();
  return false; // não deixa o Dexie reabrir sozinho
});

// Esta aba quis migrar e outra está segurando a conexão antiga.
db.on('blocked', () => {
  sinalizarDesatualizado();
});

/**
 * Abre o banco com o guard de versão. Use isto no lugar de db.open().
 *
 * Se o banco no disco estiver à frente do código, o Dexie lança VersionError —
 * traduzimos para AppDesatualizadoError para a interface mostrar a tela certa
 * em vez de morrer numa tela branca.
 */
export async function abrirBanco(): Promise<void> {
  try {
    await db.open();
  } catch (erro) {
    if (erro instanceof Dexie.VersionError) {
      sinalizarDesatualizado();
      throw new AppDesatualizadoError();
    }
    throw erro;
  }
}
