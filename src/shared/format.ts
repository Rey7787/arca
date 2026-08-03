/** "2026-08" -> "Agosto de 2026" */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "2026-08-02" -> "02/08/2026" */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Mês corrente no formato interno "2026-08", respeitando o fuso local. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Data de hoje no formato interno "2026-08-02", respeitando o fuso local. */
export function today(): string {
  const now = new Date();
  return `${currentMonth()}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Anda meses pra frente ou pra trás: shiftMonth("2026-01", -1) -> "2025-12" */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year!, m! - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Primeiro dia do mês, no formato interno. Usado ao lançar em mês passado. */
export function firstDayOf(month: string): string {
  return `${month}-01`;
}

/** Timestamp (ms) -> "02/08/2026", no fuso local. */
export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR');
}
