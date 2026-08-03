import type { Command } from '@/core/history/Command';
import type { ArcaModule, ModuleContext } from '@/core/registry/types';
import type { Repository } from '@/core/storage/repository';
import { formatMoney } from '@/core/types/money';
import type { NewTransaction, TransactionsAPI } from '@/modules/transactions';
import type { NewRecurrence, Recurrence } from './types';

export type { Recurrence, NewRecurrence };

export interface RecurrencesAPI {
  create(input: NewRecurrence): Promise<void>;
  setActive(id: string, active: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  list(): Recurrence[];
  /** Quais recorrências ainda não viraram lançamento neste mês. */
  pendingFor(month: string): Recurrence[];
  /** Gera os pendentes do mês. Retorna quantos foram lançados. */
  applyTo(month: string): Promise<number>;
}

const index = new Map<string, Recurrence>();

/** Dia 31 em fevereiro vira o último dia do mês, não escorrega pra março. */
function dateFor(month: string, dayOfMonth: number): string {
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(year!, m!, 0).getDate();
  const day = Math.min(dayOfMonth, lastDay);
  return `${month}-${String(day).padStart(2, '0')}`;
}

export const recurrencesModule: ArcaModule<RecurrencesAPI> = {
  id: 'recurrences',
  name: 'Recorrentes',
  version: '0.1.0',

  tables: { recurrences: 'id, profileId' },

  createApi(ctx: ModuleContext): RecurrencesAPI {
    const repo = ctx.repository<Recurrence>('recurrences') as Repository<Recurrence>;
    const transactions = () => ctx.require<TransactionsAPI>('transactions');

    const list = () =>
      [...index.values()].sort((a, b) => a.description.localeCompare(b.description, 'pt-BR'));

    const pendingFor = (month: string) => {
      const api = transactions();
      if (!api) return [];
      const usados = new Set(
        api.query({ month }).map((t) => t.recurrenceId).filter(Boolean) as string[],
      );
      return list().filter((r) => r.active && !usados.has(r.id));
    };

    function saveCommand(next: Recurrence, before: Recurrence | undefined, label: string): Command {
      return {
        label,
        async execute() {
          await repo.put(next);
          index.set(next.id, next);
        },
        async undo() {
          if (before) {
            await repo.put(before);
            index.set(before.id, before);
          } else {
            await repo.hardDelete(next.id);
            index.delete(next.id);
          }
        },
      };
    }

    return {
      async create(input) {
        const recurrence: Recurrence = {
          ...input,
          id: crypto.randomUUID(),
          profileId: ctx.profileId,
          active: true,
          createdAt: Date.now(),
        };
        await ctx.history.run(
          saveCommand(recurrence, undefined, `Criar recorrência ${recurrence.description}`),
        );
        ctx.bus.emit('data:changed', undefined);
      },

      async setActive(id, active) {
        const before = index.get(id);
        if (!before) return;
        await ctx.history.run(
          saveCommand({ ...before, active }, before, active ? 'Reativar recorrência' : 'Pausar recorrência'),
        );
        ctx.bus.emit('data:changed', undefined);
      },

      async remove(id) {
        const before = index.get(id);
        if (!before) return;
        await ctx.history.run({
          label: `Excluir recorrência ${before.description}`,
          async execute() {
            await repo.hardDelete(id);
            index.delete(id);
          },
          async undo() {
            await repo.put(before);
            index.set(id, before);
          },
        });
        ctx.bus.emit('data:changed', undefined);
      },

      list,
      pendingFor,

      async applyTo(month) {
        const api = transactions();
        if (!api) return 0;

        const pendentes = pendingFor(month);
        for (const r of pendentes) {
          const lancamento: NewTransaction = {
            type: r.type,
            amount: r.amount,
            date: dateFor(month, r.dayOfMonth),
            categoryId: r.categoryId,
            description: r.description,
            recurrenceId: r.id,
          };
          await api.create(lancamento);
        }
        ctx.bus.emit('data:changed', undefined);
        return pendentes.length;
      },
    };
  },

  async onUnlock(ctx) {
    const repo = ctx.repository<Recurrence>('recurrences') as Repository<Recurrence>;
    index.clear();
    for (const r of await repo.all()) index.set(r.id, r);
  },

  onLock() {
    index.clear();
  },
};

export { formatMoney };
