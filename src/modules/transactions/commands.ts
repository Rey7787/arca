import type { Command } from '@/core/history/Command';
import { formatMoney } from '@/core/types/money';
import type { Repository } from '@/core/storage/repository';
import type { MemoryIndex } from './index';
import type { NewTransaction, Transaction } from './types';

export function createTransactionCommand(
  repo: Repository<Transaction>,
  index: MemoryIndex,
  profileId: string,
  input: NewTransaction,
): Command {
  const now = Date.now();
  const transaction: Transaction = {
    ...input,
    id: crypto.randomUUID(),
    profileId,
    createdAt: now,
    updatedAt: now,
  };

  return {
    label: `Adicionar ${formatMoney(transaction.amount)}`,
    async execute() {
      await repo.put(transaction);
      index.add(transaction);
    },
    async undo() {
      await repo.hardDelete(transaction.id);
      index.remove(transaction.id);
    },
  };
}

/**
 * Exclusão é soft delete. O registro some da interface na hora e a varredura
 * física só roda no fechamento do mês — é isso que torna desfazer trivial.
 */
export function removeTransactionCommand(
  repo: Repository<Transaction>,
  index: MemoryIndex,
  transaction: Transaction,
): Command {
  return {
    label: `Excluir ${formatMoney(transaction.amount)}`,
    async execute() {
      const marked = { ...transaction, deletedAt: Date.now() };
      await repo.put(marked);
      index.update(marked);
    },
    async undo() {
      const restored = { ...transaction };
      delete restored.deletedAt;
      await repo.put(restored);
      index.update(restored);
    },
  };
}

export function updateTransactionCommand(
  repo: Repository<Transaction>,
  index: MemoryIndex,
  before: Transaction,
  patch: Partial<Transaction>,
): Command {
  const after: Transaction = { ...before, ...patch, updatedAt: Date.now() };

  return {
    label: `Editar ${formatMoney(before.amount)}`,
    async execute() {
      await repo.put(after);
      index.update(after);
    },
    async undo() {
      await repo.put(before);
      index.update(before);
    },
  };
}
