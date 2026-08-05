/**
 * Verificador de regras da Arca.
 *
 * Existe porque o mesmo bug apareceu três vezes: `toISOString()` devolve UTC,
 * e no Brasil (UTC-3) tudo que acontece depois das 21h ganha a data do dia
 * seguinte. Corrigir caso a caso não resolve — a regra precisa ser verificável.
 *
 * Roda no `npm run build`. Violação quebra o build de propósito.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

// fileURLToPath e não .pathname: no Windows o pathname vem como "/C:/Users/..."
// e a barra da frente vira um "C:\C:\..." impossível de abrir.
const SRC = fileURLToPath(new URL('../src/', import.meta.url));

const RULES = [
  {
    id: 'sem-toISOString',
    pattern: /toISOString\s*\(/,
    allow: ['shared/format.ts'],
    message:
      'toISOString() devolve UTC e erra a data no Brasil depois das 21h.\n' +
      '   Use today(), currentMonth() ou formatDate() de shared/format.ts.',
  },
  {
    id: 'sem-getMonth-solto',
    pattern: /new Date\(\)\.get(Month|Date|FullYear)\s*\(/,
    allow: ['shared/format.ts'],
    message:
      'Montar data na mão espalha a lógica de fuso pelo app.\n' +
      '   Use os helpers de shared/format.ts.',
  },
  {
    id: 'sem-localStorage',
    pattern: /\blocalStorage\b/,
    allow: [],
    message:
      'localStorage não é cifrado. Dado do usuário só entra no IndexedDB,\n' +
      '   sempre pelo Repository, que cifra antes de gravar.',
  },
  {
    id: 'iv-fixo',
    pattern: /new Uint8Array\(12\)(?!\s*\))/,
    allow: ['core/crypto/cipher.ts'],
    message:
      'IV precisa vir de randomBytes(12) a cada gravação. IV reutilizado\n' +
      '   quebra a segurança do AES-GCM por completo.',
  },
  {
    id: 'sem-reset-nativo',
    pattern: /resetPasswordForEmail/,
    allow: [],
    message:
      'O reset nativo do Supabase troca a senha no servidor sem passar pelo\n' +
      '   dispositivo: o login passaria a exigir a senha nova enquanto o cofre\n' +
      '   continuaria cifrado com a chave antiga. Recuperacao so pelo codigo\n' +
      '   de recuperacao da propria Arca. Ver docs/arca-etapa0-autenticacao.md',
  },
  {
    id: 'sem-link-magico',
    pattern: /signInWithOtp|\bmagiclink\b/,
    allow: [],
    message:
      'Link magico loga sem senha, e sem senha nao ha como derivar a chave do\n' +
      '   cofre: o usuario entraria e encontraria os proprios dados ilegiveis.',
  },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield path;
  }
}

let failures = 0;

for await (const file of walk(SRC)) {
  const rel = relative(SRC, file).replace(/\\/g, '/');
  const source = await readFile(file, 'utf8');

  for (const rule of RULES) {
    if (rule.allow.includes(rel)) continue;

    source.split('\n').forEach((line, i) => {
      // ignora linha de comentário: explicar a regra não é violá-la
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (!rule.pattern.test(line)) return;

      failures++;
      console.error(`\n✖ ${rel}:${i + 1}  [${rule.id}]`);
      console.error(`   ${line.trim()}`);
      console.error(`   ${rule.message}`);
    });
  }
}

if (failures > 0) {
  console.error(`\n${failures} violação(ões) das regras da Arca. Build interrompido.\n`);
  process.exit(1);
}

console.log('✓ Regras da Arca: tudo certo.');
