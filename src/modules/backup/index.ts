import { CURRENT_SCHEMA_VERSION, db } from '@/core/storage/db';
import { migrateRecord } from '@/core/storage/migrations';
import { webFileSystem } from '@/core/platform/web';
import { today } from '@/shared/format';
import type { ArcaModule, ModuleContext } from '@/core/registry/types';
import type { Entity, Repository } from '@/core/storage/repository';
import {
  BackupError,
  decodeBackup,
  encodeBackup,
  readHeader,
  type BackupContents,
  type BackupHeader,
} from './format';

export { BackupError, readHeader, type BackupHeader };

const TABLES = ['transactions', 'categories', 'plans', 'notes'] as const;
type TableName = (typeof TABLES)[number];

export interface BackupAPI {
  /** Gera o .arca e entrega ao usuário (gravação em pasta ou download). */
  export(password: string): Promise<{ filename: string; counts: Record<string, number> }>;
  /** Lê o cabeçalho sem senha, pra mostrar o que há no arquivo. */
  inspect(file: Uint8Array): BackupHeader;
  /** Substitui TODOS os dados do perfil pelos do arquivo. */
  restore(file: Uint8Array, password: string): Promise<Record<string, number>>;
}

export const backupModule: ArcaModule<BackupAPI> = {
  id: 'backup',
  name: 'Backup',
  version: '0.1.0',

  createApi(ctx: ModuleContext): BackupAPI {
    const repo = (table: TableName) => ctx.repository<Entity>(table) as Repository<Entity>;

    return {
      async export(password) {
        const [transactions, categories, plans, notes] = await Promise.all(
          TABLES.map((t) => repo(t).all()),
        );
        const contents: BackupContents = {
          transactions: transactions!,
          categories: categories!,
          plans: plans!,
          notes: notes!,
        };

        const bytes = await encodeBackup(contents, password);
        // today() usa o fuso local. toISOString() daria UTC e todo backup
        // feito depois das 21h no Brasil sairia com a data do dia seguinte.
        const filename = `arca-${today()}.arca`;
        await webFileSystem.saveFile(filename, bytes, 'application/octet-stream');

        return {
          filename,
          counts: {
            transactions: contents.transactions.length,
            categories: contents.categories.length,
            plans: contents.plans.length,
            notes: contents.notes.length,
          },
        };
      },

      inspect(file) {
        return readHeader(file);
      },

      async restore(file, password) {
        const { header, contents } = await decodeBackup(file, password);

        // Dado antigo passa pelas migrações antes de entrar no banco.
        const migrated: Record<TableName, Entity[]> = {
          transactions: [],
          categories: [],
          plans: [],
          notes: [],
        };
        for (const table of TABLES) {
          const records = (contents[table] ?? []) as Record<string, unknown>[];
          migrated[table] = records.map(
            (r) => migrateRecord(r, table, header.schemaVersion, CURRENT_SCHEMA_VERSION) as Entity,
          );
        }

        // Substituição total: apaga o que existe deste perfil e regrava.
        // Roda numa transação do Dexie — falhou no meio, nada é aplicado.
        await db.transaction('rw', [db.transactions, db.categories, db.plans, db.notes], async () => {
          for (const table of TABLES) {
            const existing = await repo(table).all();
            for (const record of existing) await repo(table).hardDelete(record.id);
            // Reassina os registros com o profileId ATUAL: um backup de outro
            // perfil vira dado deste perfil, cifrado com esta chave.
            await repo(table).putMany(
              migrated[table].map((r) => ({ ...r, profileId: ctx.profileId })),
            );
          }
        });

        // Restaurar não é desfazível: a pilha de undo perde o sentido.
        ctx.history.clear();

        return {
          transactions: migrated.transactions.length,
          categories: migrated.categories.length,
          plans: migrated.plans.length,
          notes: migrated.notes.length,
        };
      },
    };
  },
};
