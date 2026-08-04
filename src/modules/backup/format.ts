import { openBytes, randomBytes, sealBytes } from '@/core/crypto/cipher';
import { getKdf, preferredKdf, type KdfId, type KdfParams } from '@/core/crypto/kdf/KeyDerivation';
import { CURRENT_SCHEMA_VERSION } from '@/core/storage/db';

/**
 * Contêiner .arca
 *
 * Layout: "ARCA" | versão do formato (1 byte) | tamanho do cabeçalho (4 bytes)
 *         | cabeçalho JSON em claro | conteúdo cifrado
 *
 * O cabeçalho fica EM CLARO por necessidade: sem ele o app não sabe qual
 * algoritmo nem qual sal usar para derivar a chave e tentar abrir o arquivo.
 * Ele revela só data de criação e parâmetros — nada financeiro.
 *
 * A versão do FORMATO é independente da versão do SCHEMA. Formato muda quando
 * a estrutura do arquivo muda; schema muda quando os dados mudam de forma.
 */
const MAGIC = 'ARCA';
export const CURRENT_FORMAT_VERSION = 1;
export const APP_VERSION = __APP_VERSION__;

export interface BackupHeader {
  formatVersion: number;
  schemaVersion: number;
  appVersion: string;
  createdAt: number;
  kdf: { id: KdfId; params: KdfParams; salt: number[] };
  iv: number[];
  counts: Record<string, number>; // quantidade por tabela — confere na restauração
}

export interface BackupContents {
  transactions: unknown[];
  categories: unknown[];
  plans: unknown[];
  notes: unknown[];
}

export async function encodeBackup(
  contents: BackupContents,
  password: string,
): Promise<Uint8Array> {
  const kdf = await preferredKdf();
  const params = kdf.defaultParams();
  const salt = randomBytes(16);
  const key = await kdf.derive(password, salt, params);

  const plain = new TextEncoder().encode(JSON.stringify(contents));
  const sealed = await sealBytes(key, plain);

  const header: BackupHeader = {
    formatVersion: CURRENT_FORMAT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt: Date.now(),
    kdf: { id: kdf.id, params, salt: [...salt] },
    iv: [...sealed.iv],
    counts: {
      transactions: contents.transactions.length,
      categories: contents.categories.length,
      plans: contents.plans.length,
      notes: contents.notes.length,
    },
  };

  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const magicBytes = new TextEncoder().encode(MAGIC);

  const out = new Uint8Array(4 + 1 + 4 + headerBytes.length + sealed.payload.length);
  let offset = 0;
  out.set(magicBytes, offset); offset += 4;
  out[offset] = CURRENT_FORMAT_VERSION; offset += 1;
  new DataView(out.buffer).setUint32(offset, headerBytes.length, false); offset += 4;
  out.set(headerBytes, offset); offset += headerBytes.length;
  out.set(sealed.payload, offset);

  return out;
}

export class BackupError extends Error {}

/** Lê só o cabeçalho — permite mostrar data e conteúdo antes de pedir a senha. */
export function readHeader(file: Uint8Array): BackupHeader {
  if (file.length < 9) throw new BackupError('Arquivo pequeno demais para ser um backup da Arca.');

  const magic = new TextDecoder().decode(file.slice(0, 4));
  if (magic !== MAGIC) throw new BackupError('Este arquivo não é um backup da Arca.');

  const formatVersion = file[4]!;
  if (formatVersion > CURRENT_FORMAT_VERSION) {
    throw new BackupError(
      `Backup criado por uma versão mais nova da Arca (formato ${formatVersion}). Atualize o app para abrir.`,
    );
  }

  const headerLength = new DataView(file.buffer, file.byteOffset).getUint32(5, false);
  const headerBytes = file.slice(9, 9 + headerLength);
  return JSON.parse(new TextDecoder().decode(headerBytes)) as BackupHeader;
}

export async function decodeBackup(
  file: Uint8Array,
  password: string,
): Promise<{ header: BackupHeader; contents: BackupContents }> {
  const header = readHeader(file);
  const headerLength = new DataView(file.buffer, file.byteOffset).getUint32(5, false);
  const payload = file.slice(9 + headerLength);

  // A chave é derivada com o algoritmo e o sal DO PRÓPRIO ARQUIVO,
  // não com os parâmetros atuais do app. É isso que faz backup antigo abrir.
  const kdf = getKdf(header.kdf.id);
  const key = await kdf.derive(password, new Uint8Array(header.kdf.salt), header.kdf.params);

  let plain: Uint8Array;
  try {
    plain = await openBytes(key, { iv: new Uint8Array(header.iv), payload });
  } catch {
    throw new BackupError('Senha do backup incorreta, ou arquivo corrompido.');
  }

  const contents = JSON.parse(new TextDecoder().decode(plain)) as BackupContents;
  return { header, contents };
}
