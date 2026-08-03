import { bus } from '@/core/events/bus';

/**
 * Cofre da chave mestra. Vive SÓ em memória — nunca localStorage, nunca disco.
 *
 * Limitação honesta: JavaScript não garante apagar a chave da RAM. O coletor de
 * lixo decide quando libera. Reduzimos a janela, não a eliminamos.
 */
let masterKey: CryptoKey | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let idleMinutes = 30;
let lastActivity = 0;

export const vault = {
  get isUnlocked(): boolean {
    return masterKey !== null;
  },

  /** Lança se estiver bloqueado — chamador nunca precisa checar null. */
  key(): CryptoKey {
    if (!masterKey) throw new Error('Arca bloqueada.');
    return masterKey;
  },

  unlock(key: CryptoKey): void {
    masterKey = key;
    bus.emit('vault:unlocked', undefined);
    this.touch();
  },

  lock(): void {
    if (!masterKey) return;
    masterKey = null;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    bus.emit('vault:locked', undefined);
  },

  /** Milissegundos até o bloqueio automático. Zero se já bloqueada. */
  remainingMs(): number {
    if (!masterKey) return 0;
    return Math.max(0, lastActivity + idleMinutes * 60_000 - Date.now());
  },

  get idleLimitMinutes(): number {
    return idleMinutes;
  },

  setIdleMinutes(minutes: number): void {
    idleMinutes = minutes;
    this.touch();
  },

  /** Registra atividade e reinicia a contagem de inatividade. */
  touch(): void {
    if (!masterKey) return;
    lastActivity = Date.now();
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => this.lock(), idleMinutes * 60_000);
  },
};

// Bloqueia ao fechar a aba: não existe "manter conectado".
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => vault.lock());
  for (const evt of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(evt, () => vault.touch(), { passive: true });
  }
}
