import type { ArcaModule, ModuleContext } from '@/core/registry/types';
import type { Repository } from '@/core/storage/repository';

export interface Note {
  id: string;
  profileId: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NotesAPI {
  create(title: string, content: string): Promise<void>;
  update(id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'pinned'>>): Promise<void>;
  remove(id: string): Promise<void>;
  list(): Note[];
}

const index = new Map<string, Note>();

export const notesModule: ArcaModule<NotesAPI> = {
  id: 'notes',
  name: 'Anotações',
  version: '0.1.0',

  createApi(ctx: ModuleContext): NotesAPI {
    const repo = ctx.repository<Note>('notes') as Repository<Note>;

    return {
      async create(title, content) {
        const now = Date.now();
        const note: Note = {
          id: crypto.randomUUID(),
          profileId: ctx.profileId,
          title,
          content,
          pinned: false,
          createdAt: now,
          updatedAt: now,
        };
        await ctx.history.run({
          label: 'Criar anotação',
          async execute() {
            await repo.put(note);
            index.set(note.id, note);
          },
          async undo() {
            await repo.hardDelete(note.id);
            index.delete(note.id);
          },
        });
        ctx.bus.emit('data:changed', undefined);
      },

      async update(id, patch) {
        const before = index.get(id);
        if (!before) return;
        const after = { ...before, ...patch, updatedAt: Date.now() };
        await ctx.history.run({
          label: 'Editar anotação',
          async execute() {
            await repo.put(after);
            index.set(id, after);
          },
          async undo() {
            await repo.put(before);
            index.set(id, before);
          },
        });
        ctx.bus.emit('data:changed', undefined);
      },

      async remove(id) {
        const before = index.get(id);
        if (!before) return;
        await ctx.history.run({
          label: `Excluir anotação ${before.title}`,
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

      list() {
        return [...index.values()].sort(
          (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
        );
      },
    };
  },

  async onUnlock(ctx) {
    const repo = ctx.repository<Note>('notes') as Repository<Note>;
    index.clear();
    for (const n of await repo.all()) index.set(n.id, n);
  },

  onLock() {
    index.clear();
  },
};
