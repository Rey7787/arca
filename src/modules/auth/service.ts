import {
  generateMasterKeyBytes,
  importMasterKey,
  openBytes,
  sealBytes,
  randomBytes,
} from '@/core/crypto/cipher';
import { getKdf, preferredKdf } from '@/core/crypto/kdf/KeyDerivation';
import { generateRecoveryCode, normalizeRecoveryCode } from '@/core/crypto/recoveryCode';
import { vault } from '@/core/crypto/vault';
import { CURRENT_SCHEMA_VERSION, db, type VaultMeta } from '@/core/storage/db';

export interface CreatedProfile {
  profileId: string;
  recoveryCode: string;
}

export async function listProfiles(): Promise<VaultMeta[]> {
  return db.meta.toArray();
}

/**
 * Primeiro uso. Duas chaves de propósito: trocar a senha depois recifra só a
 * chave mestra (~32 bytes) em vez de reprocessar o banco inteiro.
 */
export async function createProfile(label: string, password: string): Promise<CreatedProfile> {
  const kdf = await preferredKdf();
  const params = kdf.defaultParams();

  const salt = randomBytes(16);
  const recoverySalt = randomBytes(16);
  const recoveryCode = generateRecoveryCode();

  const masterRaw = generateMasterKeyBytes();

  const passwordKey = await kdf.derive(password, salt, params);
  const recoveryKey = await kdf.derive(recoveryCode, recoverySalt, params);

  const wrapped = await sealBytes(passwordKey, masterRaw);
  const wrappedRecovery = await sealBytes(recoveryKey, masterRaw);

  const profileId = crypto.randomUUID();
  await db.meta.put({
    id: profileId,
    label,
    kdfId: kdf.id,
    kdfParams: params,
    salt,
    wrappedMaster: wrapped.payload,
    wrappedMasterIv: wrapped.iv,
    recoverySalt,
    wrappedMasterRecovery: wrappedRecovery.payload,
    wrappedMasterRecoveryIv: wrappedRecovery.iv,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: Date.now(),
  });

  vault.unlock(await importMasterKey(masterRaw));
  masterRaw.fill(0);

  return { profileId, recoveryCode };
}

/**
 * Senha errada = o AES-GCM falha na autenticação. Por isso não guardamos hash
 * de senha em lugar nenhum.
 */
export async function unlock(profileId: string, password: string): Promise<boolean> {
  const meta = await db.meta.get(profileId);
  if (!meta) return false;

  const kdf = getKdf(meta.kdfId);
  const key = await kdf.derive(password, meta.salt, meta.kdfParams);

  try {
    const masterRaw = await openBytes(key, {
      iv: meta.wrappedMasterIv,
      payload: meta.wrappedMaster,
    });
    vault.unlock(await importMasterKey(masterRaw));
    vault.setIdleMinutes(meta.idleMinutes ?? 30);
    masterRaw.fill(0);
    return true;
  } catch {
    return false; // senha errada
  }
}

export async function unlockWithRecoveryCode(profileId: string, code: string): Promise<boolean> {
  const meta = await db.meta.get(profileId);
  if (!meta) return false;

  const kdf = getKdf(meta.kdfId);
  const key = await kdf.derive(normalizeRecoveryCode(code), meta.recoverySalt, meta.kdfParams);

  try {
    const masterRaw = await openBytes(key, {
      iv: meta.wrappedMasterRecoveryIv,
      payload: meta.wrappedMasterRecovery,
    });
    vault.unlock(await importMasterKey(masterRaw));
    masterRaw.fill(0);
    return true;
  } catch {
    return false;
  }
}

export function lock(): void {
  vault.lock();
}

export const IDLE_OPTIONS = [5, 15, 30, 60] as const;

export async function getIdleMinutes(profileId: string): Promise<number> {
  const meta = await db.meta.get(profileId);
  return meta?.idleMinutes ?? 30;
}

export async function setIdleMinutes(profileId: string, minutes: number): Promise<void> {
  const meta = await db.meta.get(profileId);
  if (!meta) return;
  await db.meta.put({ ...meta, idleMinutes: minutes });
  vault.setIdleMinutes(minutes);
}

/**
 * Troca a senha recifrando SÓ a chave mestra (~32 bytes).
 * É por isso que existem duas chaves: se a senha cifrasse os dados direto,
 * trocar senha significaria reprocessar o banco inteiro, com risco de
 * corromper tudo se faltasse energia no meio.
 */
export async function changePassword(
  profileId: string,
  currentPassword: string,
  nextPassword: string,
): Promise<boolean> {
  const meta = await db.meta.get(profileId);
  if (!meta) return false;

  const currentKdf = getKdf(meta.kdfId);
  const currentKey = await currentKdf.derive(currentPassword, meta.salt, meta.kdfParams);

  let masterRaw: Uint8Array;
  try {
    masterRaw = await openBytes(currentKey, {
      iv: meta.wrappedMasterIv,
      payload: meta.wrappedMaster,
    });
  } catch {
    return false; // senha atual errada
  }

  // Aproveita para migrar ao melhor algoritmo disponível hoje.
  const kdf = await preferredKdf();
  const params = kdf.defaultParams();
  const salt = randomBytes(16);
  const nextKey = await kdf.derive(nextPassword, salt, params);
  const wrapped = await sealBytes(nextKey, masterRaw);

  await db.meta.put({
    ...meta,
    kdfId: kdf.id,
    kdfParams: params,
    salt,
    wrappedMaster: wrapped.payload,
    wrappedMasterIv: wrapped.iv,
  });

  masterRaw.fill(0);
  return true;
}

/**
 * Gera um código de recuperação novo e invalida o anterior.
 * Necessário quando o código antigo vazou — ele abre a chave mestra
 * exatamente como a senha.
 */
export async function regenerateRecoveryCode(
  profileId: string,
  password: string,
): Promise<string | null> {
  const meta = await db.meta.get(profileId);
  if (!meta) return null;

  const kdf = getKdf(meta.kdfId);
  const key = await kdf.derive(password, meta.salt, meta.kdfParams);

  let masterRaw: Uint8Array;
  try {
    masterRaw = await openBytes(key, { iv: meta.wrappedMasterIv, payload: meta.wrappedMaster });
  } catch {
    return null; // senha errada
  }

  const recoveryCode = generateRecoveryCode();
  const recoverySalt = randomBytes(16);
  const recoveryKey = await kdf.derive(recoveryCode, recoverySalt, meta.kdfParams);
  const wrapped = await sealBytes(recoveryKey, masterRaw);

  await db.meta.put({
    ...meta,
    recoverySalt,
    wrappedMasterRecovery: wrapped.payload,
    wrappedMasterRecoveryIv: wrapped.iv,
  });

  masterRaw.fill(0);
  return recoveryCode;
}
