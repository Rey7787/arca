import type { KdfParams, KeyDerivation } from './KeyDerivation';
import { registerKdf } from './KeyDerivation';

/** 600.000 iterações é a recomendação atual do OWASP para PBKDF2-SHA256. */
const DEFAULT_ITERATIONS = 600_000;

export const pbkdf2: KeyDerivation = {
  id: 'pbkdf2',

  async isAvailable() {
    return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
  },

  defaultParams(): KdfParams {
    return { iterations: DEFAULT_ITERATIONS, hash: 'SHA-256' };
  },

  async derive(password: string, salt: Uint8Array, params: KdfParams): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: Number(params.iterations ?? DEFAULT_ITERATIONS),
        hash: String(params.hash ?? 'SHA-256'),
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false, // não extraível: a chave derivada nunca sai do WebCrypto
      ['encrypt', 'decrypt'],
    );
  },
};

registerKdf(pbkdf2);
