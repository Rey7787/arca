/**
 * Código de recuperação: a rede de segurança que substitui o "esqueci minha
 * senha" de um servidor. Abre a mesma chave mestra por um caminho paralelo.
 *
 * Alfabeto Crockford base32 (sem I, L, O, U) — evita confundir 0/O e 1/I
 * na hora de copiar do papel.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS = 6;
const GROUP_SIZE = 5;

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(GROUPS * GROUP_SIZE));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]!);
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i++) {
    groups.push(chars.slice(i * GROUP_SIZE, (i + 1) * GROUP_SIZE).join(''));
  }
  return groups.join('-'); // ex.: A3K9M-2PQ7T-...  (~150 bits de entropia)
}

/** Aceita minúscula, espaço e hífen faltando — o usuário digita do papel. */
export function normalizeRecoveryCode(input: string): string {
  const clean = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const groups: string[] = [];
  for (let i = 0; i < clean.length; i += GROUP_SIZE) {
    groups.push(clean.slice(i, i + GROUP_SIZE));
  }
  return groups.join('-');
}
