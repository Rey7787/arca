import { bus } from '@/core/events/bus';
import { history } from '@/core/history/HistoryStack';
import { db } from '@/core/storage/db';
import { Repository, type Entity } from '@/core/storage/repository';
import type { ArcaModule, MenuItem, ModuleContext, RouteDefinition } from './types';

/**
 * Registry interno de módulos. Substitui a ideia de sistema de plugins:
 * mesma extensibilidade, sem carregar código externo.
 *
 * Adicionar patrimônio, investimentos ou documentos = criar a pasta do módulo
 * e chamar registry.register(). O núcleo não muda.
 */
class ModuleRegistry {
  private modules = new Map<string, ArcaModule>();
  private apis = new Map<string, unknown>();
  private profileId: string | null = null;

  register(module: ArcaModule): void {
    if (this.modules.has(module.id)) {
      // Em desenvolvimento o Vite reexecuta o main.tsx a cada hot reload.
      // Substituir é o comportamento certo aqui; em produção seria bug real.
      if (import.meta.env.DEV) {
        this.modules.set(module.id, module);
        return;
      }
      throw new Error(`Módulo já registrado: ${module.id}`);
    }
    this.modules.set(module.id, module);
  }

  has(id: string): boolean {
    return this.modules.has(id);
  }

  get all(): ArcaModule[] {
    return [...this.modules.values()];
  }

  get routes(): RouteDefinition[] {
    return this.all.flatMap((m) => m.routes ?? []);
  }

  get menu(): MenuItem[] {
    return this.all
      .flatMap((m) => m.menuItems ?? [])
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  private schemaApplied = false;

  /** Roda uma vez no boot: junta as tabelas que os módulos declararam. */
  applySchema(startingVersion: number): void {
    if (this.schemaApplied) return; // idem: hot reload não pode reabrir o schema
    this.schemaApplied = true;
    const stores: Record<string, string> = {};
    for (const module of this.all) {
      Object.assign(stores, module.tables ?? {});
    }
    if (Object.keys(stores).length > 0) {
      db.addModuleTables(startingVersion, stores);
    }
  }

  private contextFor(moduleId: string): ModuleContext {
    if (!this.profileId) throw new Error('Nenhum perfil ativo.');
    const profileId = this.profileId;
    return {
      profileId,
      repository: <T extends Entity>(table: string) =>
        new Repository<T>((db as never as Record<string, never>)[table], profileId),
      bus,
      history,
      require: <T,>(id: string) => this.apis.get(id) as T | undefined,
    };
  }

  /** Chamado depois do unlock: cada módulo carrega o que precisa. */
  async activate(profileId: string): Promise<void> {
    this.profileId = profileId;

    for (const module of this.all) {
      const ctx = this.contextFor(module.id);
      module.onRegister?.(ctx);
      if (module.createApi) this.apis.set(module.id, module.createApi(ctx));
    }

    for (const module of this.all) {
      await module.onUnlock?.(this.contextFor(module.id));
    }
  }

  deactivate(): void {
    for (const module of this.all) module.onLock?.();
    this.apis.clear();
    this.profileId = null;
  }

  api<T>(moduleId: string): T {
    const api = this.apis.get(moduleId);
    if (!api) throw new Error(`Módulo sem API ativa: ${moduleId}`);
    return api as T;
  }
}

export const registry = new ModuleRegistry();

bus.on('vault:locked', () => registry.deactivate());
