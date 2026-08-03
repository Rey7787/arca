import type { Command } from '@/core/history/Command';
import type { ArcaModule, ModuleContext } from '@/core/registry/types';
import type { Repository } from '@/core/storage/repository';
import type { Money } from '@/core/types/money';

/**
 * Plano do mês. O saldo inicial é digitado manualmente a cada mês — decisão
 * do projeto: nada é herdado nem calculado automaticamente do mês anterior.
 */
export interface MonthlyPlan {
  id: string; // "2026-08" — o próprio mês é a chave
  profileId: string;
  openingBalance: Money;
  closed: boolean;
  closedAt?: number;
  updatedAt: number;
}

export interface PlanAPI {
  get(month: string): MonthlyPlan | undefined;
  openingBalance(month: string): Money;
  setOpeningBalance(month: string, amount: Money): Promise<void>;
}

const index = new Map<string, MonthlyPlan>();

function setOpeningBalanceCommand(
  repo: Repository<MonthlyPlan>,
  profileId: string,
  month: string,
  amount: Money,
): Command {
  const before = index.get(month);
  const after: MonthlyPlan = {
    id: month,
    profileId,
    openingBalance: amount,
    closed: before?.closed ?? false,
    ...(before?.closedAt !== undefined ? { closedAt: before.closedAt } : {}),
    updatedAt: Date.now(),
  };

  return {
    label: 'Definir saldo inicial',
    async execute() {
      await repo.put(after);
      index.set(month, after);
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

export const planModule: ArcaModule<PlanAPI> = {
  id: 'plan',
  name: 'Planejamento',
  version: '0.1.0',

  createApi(ctx: ModuleContext): PlanAPI {
    const repo = ctx.repository<MonthlyPlan>('plans') as Repository<MonthlyPlan>;

    return {
      get(month) {
        return index.get(month);
      },
      openingBalance(month) {
        return index.get(month)?.openingBalance ?? 0;
      },
      async setOpeningBalance(month, amount) {
        await ctx.history.run(setOpeningBalanceCommand(repo, ctx.profileId, month, amount));
        ctx.bus.emit('plan:changed', { month });
      },
    };
  },

  async onUnlock(ctx) {
    const repo = ctx.repository<MonthlyPlan>('plans') as Repository<MonthlyPlan>;
    index.clear();
    for (const plan of await repo.all()) index.set(plan.id, plan);
  },

  onLock() {
    index.clear();
  },
};
