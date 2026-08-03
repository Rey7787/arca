/**
 * Derivação de chave plugável.
 *
 * Hoje só existe PBKDF2 (nativo no WebCrypto). Argon2id entra depois, via wasm,
 * implementando esta mesma interface. O registro `meta` guarda QUAL algoritmo e
 * QUAIS parâmetros foram usados, então um cofre antigo continua abrindo mesmo
 * depois de o padrão mudar.
 */
export type KdfId = 'pbkdf2' | 'argon2id';

export interface KdfParams {
  readonly [key: string]: string | number;
}

export interface KeyDerivation {
  readonly id: KdfId;
  isAvailable(): Promise<boolean>;
  defaultParams(): KdfParams;
  derive(password: string, salt: Uint8Array, params: KdfParams): Promise<CryptoKey>;
}

const registry = new Map<KdfId, KeyDerivation>();

export function registerKdf(kdf: KeyDerivation): void {
  registry.set(kdf.id, kdf);
}

export function getKdf(id: KdfId): KeyDerivation {
  const kdf = registry.get(id);
  if (!kdf) throw new Error(`Algoritmo de derivação não disponível nesta versão: ${id}`);
  return kdf;
}

/** Melhor algoritmo disponível agora. Vira argon2id quando ele existir. */
export async function preferredKdf(): Promise<KeyDerivation> {
  for (const id of ['argon2id', 'pbkdf2'] as const) {
    const kdf = registry.get(id);
    if (kdf && (await kdf.isAvailable())) return kdf;
  }
  throw new Error('Nenhum algoritmo de derivação disponível neste navegador.');
}
