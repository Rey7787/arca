/**
 * Migrações de DADO (o conteúdo dentro do envelope cifrado).
 *
 * Compromisso assumido no projeto: estas funções ficam no código PARA SEMPRE.
 * São o que garante que um backup de 2026 ainda abre em 2031. São puras e
 * minúsculas — o custo de mantê-las é irrisório perto de um backup que não abre.
 */
export interface DataMigration {
  from: number;
  to: number;
  table: string; // '*' vale para todas
  up(record: Record<string, unknown>): Record<string, unknown>;
}

const migrations: DataMigration[] = [
  // Nenhuma ainda: a versão 1 é a original.
  // Exemplo de como será:
  // { from: 1, to: 2, table: 'transactions',
  //   up: (t) => ({ ...t, tags: t.tags ?? [] }) },
];

export function registerMigration(migration: DataMigration): void {
  migrations.push(migration);
}

/** Aplica em cadeia da versão do dado até a versão atual do app. */
export function migrateRecord<T>(record: T, table: string, from: number, to: number): T {
  let current = record as Record<string, unknown>;
  for (let v = from; v < to; v++) {
    for (const m of migrations) {
      if (m.from === v && (m.table === table || m.table === '*')) {
        current = m.up(current);
      }
    }
  }
  return current as T;
}
