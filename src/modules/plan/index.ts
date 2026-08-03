import type { Command } from '@/core/history/Command';
import type { ArcaModule, ModuleContext } from '@/core/registry/types';
import type { Repository } from '@/core/storage/repository';
import type { Money } from '@/core/types/money';
import type { TransactionsAPI } from '@/modules/transactions';

/**
 * Plano do mês: saldo inicial, metas por categoria e o fechamento.
 *
 * O saldo inicial é digitado manualmente a cada mês — decisão do projeto:
 * nada é herdado nem calculado automaticamente do mês anterior.
 */
export interface Budget {
  categoryId: string;
  limit: Money;
}

export interface MonthlyPlan {
  id: string; // "2026-08" — o próprio mês é a chave
  profileId: string;
  openingBalance: Money;
  budgets: Budget[];
  closed: boolean;
  closedAt?: number;
  updatedAt: number;
}

export interface PlanAPI {
  get(month: string): MonthlyPlan | undefined;
  openingBalance(month: string): Money;
  setOpeningBalance(month: string, amount: Money): Promise<void>;

  isClosed(month: string): boolean;
  /** Fecha o mês e apaga fisicamente os lançamentos excluídos. Não é desfazível. */
  close(month: string): Promise<{ purged: number }>;
  reopen(month: string): Promise<void>;

  budgets(month: string): Budget[];
  budgetFor(month: string, categoryId: string): Money;
  setBudget(month: string, categoryId: string, limit: Money): Promise<void>;
}

const index = new Map<string, MonthlyPlan>();

function blank(month: string, profileId: string): MonthlyPlan {
  return {
    id: month,
    profileId,
    openingBalance: 0,
    budgets: [],
    closed: false,
    updatedAt: Date.now(),
  };
}

export const planModule: ArcaModule<PlanAPI> = {
  id: 'plan',
  name: 'Planejamento',
  version: '0.2.0',

  createApi(ctx: ModuleContext): PlanAPI {
    const repo = ctx.repository<MonthlyPlan>('plans') as Repository<MonthlyPlan>;

    function saveCommand(month: string, next: MonthlyPlan, label: string): Command {
      const before = index.get(month);
      return {
        label,
        async execute() {
          await repo.put(next);
          index.set(month, next);
        },
        async undo() {
          if (before) {
            await repo.put(before);
            index.set(month, before);
          } else {
            await repo.hardDelete(month);
            index.delete(month);
          }
        },
      };
    }

    const planFor = (month: string) => index.get(month) ?? blank(month, ctx.profileId);

    return {
      get: (month) => index.get(month),
      openingBalance: (month) => index.get(month)?.openingBalance ?? 0,

      async setOpeningBalance(month, amount) {
        const next = { ...planFor(month), openingBalance: amount, updatedAt: Date.now() };
        await ctx.history.run(saveCommand(month, next, 'Definir saldo inicial'));
        ctx.bus.emit('plan:changed', { month });
      },

      isClosed: (month) => index.get(month)?.closed ?? false,

      async close(month) {
        // A varredura é destrutiva de propósito: o soft delete existe para
        // sustentar o desfazer durante o mês, não para sempre.
        const transactions = ctx.require<TransactionsAPI>('transactions');
        const purged = (await transactions?.purgeDeleted(month)) ?? 0;

        const next: MonthlyPlan = {
          ...planFor(month),
          closed: true,
          closedAt: Date.now(),
          updatedAt: Date.now(),
        };
        await repo.put(next);
        index.set(month, next);

        // Fechar apaga registros de vez — desfazer deixaria a pilha mentindo.
        ctx.history.clear();
        ctx.bus.emit('plan:changed', { month });
        return { purged };
      },

      async reopen(month) {
        const atual = index.get(month);
        if (!atual) return;
        const next: MonthlyPlan = { ...atual, closed: false, updatedAt: Date.now() };
        delete next.closedAt;
        await repo.put(next);
        index.set(month, next);
        ctx.bus.emit('plan:changed', { month });
      },

      budgets: (month) => index.get(month)?.budgets ?? [],

      budgetFor: (month, categoryId) =>
        index.get(month)?.budgets.find((b) => b.categoryId === categoryId)?.limit ?? 0,

      async setBudget(month, categoryId, limit) {
        const atual = planFor(month);
        const budgets = atual.budgets.filter((b) => b.categoryId !== categoryId);
        if (limit > 0) budgets.push({ categoryId, limit });

        const next = { ...atual, budgets, updatedAt: Date.now() };
        await ctx.history.run(saveCommand(month, next, 'Definir meta da categoria'));
        ctx.bus.emit('plan:changed', { month });
      },
    };
  },

  async onUnlock(ctx) {
    const repo = ctx.repository<MonthlyPlan>('plans') as Repository<MonthlyPlan>;
    index.clear();
    for (const plan of await repo.all()) {
      // Planos gravados antes das metas existirem não têm o campo.
      index.set(plan.id, { ...plan, budgets: plan.budgets ?? [] });
    }
  },

  onLock() {
    index.clear();
  },
};
