import type { Command } from '@/core/history/Command';
import type { Repository } from '@/core/storage/repository';
import type { Category, NewCategory } from './types';

type Index = Map<string, Category>;

export function createCategoryCommand(
  repo: Repository<Category>,
  index: Index,
  profileId: string,
  input: NewCategory,
): Command {
  const category: Category = {
    ...input,
    id: crypto.randomUUID(),
    profileId,
    archived: false,
    order: index.size,
    createdAt: Date.now(),
  };

  return {
    label: `Criar categoria ${category.name}`,
    async execute() {
      await repo.put(category);
      index.set(category.id, category);
    },
    async undo() {
      await repo.hardDelete(category.id);
      index.delete(category.id);
    },
  };
}

export function updateCategoryCommand(
  repo: Repository<Category>,
  index: Index,
  before: Category,
  patch: Partial<Category>,
): Command {
  const after = { ...before, ...patch };
  return {
    label: `Editar categoria ${before.name}`,
    async execute() {
      await repo.put(after);
      index.set(after.id, after);
    },
    async undo() {
      await repo.put(before);
      index.set(before.id, before);
    },
  };
}

/** Arquivar, não excluir: lançamento antigo continua sabendo de onde veio. */
export function archiveCategoryCommand(
  repo: Repository<Category>,
  index: Index,
  category: Category,
  archived: boolean,
): Command {
  return {
    label: archived ? `Arquivar ${category.name}` : `Reativar ${category.name}`,
    async execute() {
      const next = { ...category, archived };
      await repo.put(next);
      index.set(next.id, next);
    },
    async undo() {
      await repo.put(category);
      index.set(category.id, category);
    },
  };
}
