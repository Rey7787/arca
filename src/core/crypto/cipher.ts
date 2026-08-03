/**
 * AES-GCM 256. O IV é SEMPRE novo a cada gravação — reusar IV com a mesma
 * chave quebra a segurança do GCM por completo.
 *
 * O GCM já autentica: registro adulterado falha na decifragem em vez de
 * devolver lixo. É por isso que não guardamos hash de senha em lugar nenhum —
 * senha errada simplesmente não desenvelopa a chave mestra.
 */
export interface Sealed {
  iv: Uint8Array;
  payload: Uint8Array;
}

const IV_BYTES = 12;

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export async function sealBytes(key: CryptoKey, data: Uint8Array): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES);
  const payload = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data as BufferSource,
  );
  return { iv, payload: new Uint8Array(payload) };
}

export async function openBytes(key: CryptoKey, sealed: Sealed): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.iv as BufferSource },
    key,
    sealed.payload as BufferSource,
  );
  return new Uint8Array(plain);
}

export async function sealJson<T>(key: CryptoKey, value: T): Promise<Sealed> {
  return sealBytes(key, new TextEncoder().encode(JSON.stringify(value)));
}

export async function openJson<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const bytes = await openBytes(key, sealed);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/** Chave mestra: 32 bytes aleatórios, importados como AES-GCM. */
export function generateMasterKeyBytes(): Uint8Array {
  return randomBytes(32);
}

export async function importMasterKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
