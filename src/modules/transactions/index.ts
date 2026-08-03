import type { ArcaModule, ModuleContext } from '@/core/registry/types';
import type { Repository } from '@/core/storage/repository';
import type { Money } from '@/core/types/money';
import {
  createTransactionCommand,
  removeTransactionCommand,
  updateTransactionCommand,
} from './commands';
import type { NewTransaction, Transaction, TransactionFilter } from './types';

export type { Transaction, NewTransaction, TransactionFilter };

/**
 * Payload cifrado não é indexável pelo IndexedDB. No unlock decifra tudo uma
 * vez e monta o índice aqui. Com 50 mil lançamentos: ~10 MB de RAM, ~2 s.
 */
export class MemoryIndex {
  byId = new Map<string, Transaction>();
  byMonth = new Map<string, Set<string>>();

  load(transactions: Transaction[]): void {
    this.byId.clear();
    this.byMonth.clear();
    for (const t of transactions) this.add(t);
  }

  add(t: Transaction): void {
    this.byId.set(t.id, t);
    const month = t.date.slice(0, 7);
    let set = this.byMonth.get(month);
    if (!set) {
      set = new Set();
      this.byMonth.set(month, set);
    }
    set.add(t.id);
  }

  update(t: Transaction): void {
    this.byId.set(t.id, t);
  }

  remove(id: string): void {
    const t = this.byId.get(id);
    if (!t) return;
    this.byId.delete(id);
    this.byMonth.get(t.date.slice(0, 7))?.delete(id);
  }

  clear(): void {
    this.byId.clear();
    this.byMonth.clear();
  }
}

export interface TransactionsAPI {
  create(input: NewTransaction): Promise<Transaction>;
  update(id: string, patch: Partial<Transaction>): Promise<void>;
  remove(id: string): Promise<void>;
  getById(id: string): Transaction | undefined;
  query(filter?: TransactionFilter): Transaction[];
  totalsByMonth(month: string): { income: Money; expense: Money; balance: Money };
  /**
   * Apaga de vez os lançamentos marcados como excluídos no mês.
   * Roda no fechamento do mês — até lá o soft delete sustenta o desfazer.
   */
  purgeDeleted(month: string): Promise<number>;
}

const index = new MemoryIndex();

export const transactionsModule: ArcaModule<TransactionsAPI> = {
  id: 'transactions',
  name: 'Lançamentos',
  version: '0.1.0',

  createApi(ctx: ModuleContext): TransactionsAPI {
    const repo = ctx.repository<Transaction>('transactions') as Repository<Transaction>;

    return {
      async create(input) {
        const command = createTransactionCommand(repo, index, ctx.profileId, input);
        await ctx.history.run(command);
        // o comando já inseriu no índice; devolve a última versão gravada
        return [...index.byId.values()].at(-1)!;
      },

      async update(id, patch) {
        const before = index.byId.get(id);
        if (!before) throw new Error('Lançamento não encontrado.');
        await ctx.history.run(updateTransactionCommand(repo, index, before, patch));
      },

      async remove(id) {
        const transaction = index.byId.get(id);
        if (!transaction) throw new Error('Lançamento não encontrado.');
        await ctx.history.run(removeTransactionCommand(repo, index, transaction));
      },

      getById(id) {
        const t = index.byId.get(id);
        return t && !t.deletedAt ? t : undefined;
      },

      query(filter = {}) {
        let results = [...index.byId.values()].filter((t) => !t.deletedAt);

        if (filter.month) results = results.filter((t) => t.date.startsWith(filter.month!));
        if (filter.type) results = results.filter((t) => t.type === filter.type);
        if (filter.categoryId) results = results.filter((t) => t.categoryId === filter.categoryId);
        if (filter.search) {
          const needle = filter.search.toLowerCase();
          results = results.filter((t) => t.description.toLowerCase().includes(needle));
        }

        return results.sort((a, b) => b.date.localeCompare(a.date));
      },

      async purgeDeleted(month) {
        const alvos = [...index.byId.values()].filter(
          (t) => t.deletedAt && t.date.startsWith(month),
        );
        for (const t of alvos) {
          await repo.hardDelete(t.id);
          index.remove(t.id);
        }
        return alvos.length;
      },

      totalsByMonth(month) {
        let income = 0;
        let expense = 0;
        for (const t of index.byId.values()) {
          if (t.deletedAt || !t.date.startsWith(month)) continue;
          if (t.type === 'income') income += t.amount;
          else expense += t.amount;
        }
        return { income, expense, balance: income - expense };
      },
    };
  },

  async onUnlock(ctx) {
    const repo = ctx.repository<Transaction>('transactions') as Repository<Transaction>;
    index.load(await repo.all());
  },

  onLock() {
    index.clear();
  },
};
