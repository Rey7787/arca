import type { ArcaModule, ModuleContext } from '@/core/registry/types';
import type { Repository } from '@/core/storage/repository';
import { archiveCategoryCommand, createCategoryCommand, updateCategoryCommand } from './commands';
import { SEED_CATEGORIES, type Category, type NewCategory } from './types';

export type { Category, NewCategory };

export interface CategoriesAPI {
  create(input: NewCategory): Promise<void>;
  update(id: string, patch: Partial<Category>): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
  getById(id: string): Category | undefined;
  list(options?: { type?: 'income' | 'expense'; includeArchived?: boolean }): Category[];
}

const index = new Map<string, Category>();

export const categoriesModule: ArcaModule<CategoriesAPI> = {
  id: 'categories',
  name: 'Categorias',
  version: '0.1.0',

  createApi(ctx: ModuleContext): CategoriesAPI {
    const repo = ctx.repository<Category>('categories') as Repository<Category>;

    return {
      async create(input) {
        await ctx.history.run(createCategoryCommand(repo, index, ctx.profileId, input));
        ctx.bus.emit('category:changed', undefined);
      },
      async update(id, patch) {
        const before = index.get(id);
        if (!before) throw new Error('Categoria não encontrada.');
        await ctx.history.run(updateCategoryCommand(repo, index, before, patch));
        ctx.bus.emit('category:changed', undefined);
      },
      async setArchived(id, archived) {
        const category = index.get(id);
        if (!category) throw new Error('Categoria não encontrada.');
        await ctx.history.run(archiveCategoryCommand(repo, index, category, archived));
        ctx.bus.emit('category:changed', undefined);
      },
      getById(id) {
        return index.get(id);
      },
      list(options = {}) {
        return [...index.values()]
          .filter((c) => (options.includeArchived ? true : !c.archived))
          .filter((c) => !options.type || c.type === options.type || c.type === 'both')
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
      },
    };
  },

  async onUnlock(ctx) {
    const repo = ctx.repository<Category>('categories') as Repository<Category>;
    const existing = await repo.all();
    index.clear();
    for (const c of existing) index.set(c.id, c);

    // Primeiro uso: semeia as sugestões iniciais direto no repositório
    // (sem passar pelo histórico — não faz sentido "desfazer" a semeadura).
    if (existing.length === 0) {
      const seeded: Category[] = SEED_CATEGORIES.map((seed, order) => ({
        ...seed,
        id: crypto.randomUUID(),
        profileId: ctx.profileId,
        archived: false,
        order,
        createdAt: Date.now(),
      }));
      await repo.putMany(seeded);
      for (const c of seeded) index.set(c.id, c);
    }
  },

  onLock() {
    index.clear();
  },
};
