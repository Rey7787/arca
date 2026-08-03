type Handler<T> = (payload: T) => void;

export interface ArcaEvents {
  'vault:unlocked': undefined;
  'vault:locked': undefined;
  'transaction:created': { id: string; month: string };
  'transaction:updated': { id: string; month: string };
  'transaction:removed': { id: string; month: string };
  'history:changed': undefined;
  'data:changed': undefined;
  'category:changed': undefined;
  'plan:changed': { month: string };
}

export class EventBus {
  private handlers = new Map<keyof ArcaEvents, Set<Handler<never>>>();

  on<K extends keyof ArcaEvents>(event: K, handler: Handler<ArcaEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => set!.delete(handler as Handler<never>);
  }

  emit<K extends keyof ArcaEvents>(event: K, payload: ArcaEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) (handler as Handler<ArcaEvents[K]>)(payload);
  }
}

export const bus = new EventBus();
