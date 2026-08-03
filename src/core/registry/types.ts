import type { ComponentType } from 'preact';
import type { Repository, Entity } from '@/core/storage/repository';
import type { HistoryStack } from '@/core/history/HistoryStack';
import type { EventBus } from '@/core/events/bus';

export interface RouteDefinition {
  path: string;
  component: ComponentType;
}

export interface MenuItem {
  label: string;
  path: string;
  icon?: string;
  order?: number;
}

export interface Migration {
  from: number;
  to: number;
  up(record: unknown): unknown;
}

/**
 * O que o núcleo entrega a um módulo. É o ÚNICO caminho de acesso —
 * módulo não importa o Dexie, não conhece o envelope, não vê a chave.
 */
export interface ModuleContext {
  profileId: string;
  repository<T extends Entity>(table: string): Repository<T>;
  bus: EventBus;
  history: HistoryStack;
  /** Dependência entre módulos, declarada e resolvida pelo registry. */
  require<T>(moduleId: string): T | undefined;
}

/**
 * Um módulo da Arca. Não é plugin: é código do próprio projeto que se
 * auto-registra. Nada externo roda aqui dentro — o app segura a chave mestra
 * em memória, e carregar código de terceiro seria entregar tudo.
 */
export interface ArcaModule<API = unknown> {
  id: string;
  name: string;
  version: string;

  tables?: Record<string, string>; // nome -> índices do Dexie
  migrations?: Migration[];
  routes?: RouteDefinition[];
  menuItems?: MenuItem[];

  /** API pública que outros módulos consomem via ctx.require. */
  createApi?(ctx: ModuleContext): API;

  onRegister?(ctx: ModuleContext): void;
  onUnlock?(ctx: ModuleContext): Promise<void>;
  onLock?(): void;
}
