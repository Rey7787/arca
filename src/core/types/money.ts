/**
 * Valor monetário SEMPRE em centavos, como inteiro.
 * 0.1 + 0.2 em ponto flutuante dá 0.30000000000000004 — num app financeiro
 * isso vira centavo perdido em relatório. Por isso nunca usamos decimal.
 */
export type Money = number;

export const fromReais = (reais: number): Money => Math.round(reais * 100);
export const toReais = (cents: Money): number => cents / 100;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatMoney = (cents: Money): string => brl.format(cents / 100);

/** Converte "1.234,56" ou "1234,56" ou "1234.56" em centavos. */
export function parseMoney(input: string): Money | null {
  const clean = input.trim().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (!clean || !/^-?\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}

/**
 * Máscara de digitação: o usuário só tecla números e a vírgula se posiciona
 * sozinha, sempre com duas casas. Digitar "4990" mostra "49,90".
 *
 * É o comportamento de caixa de supermercado e de app de banco — quem digita
 * valor o dia todo espera exatamente isso.
 */
export function maskMoneyInput(raw: string): { display: string; cents: Money } {
  const digits = raw.replace(/\D/g, '').slice(0, 12); // teto: R$ 9.999.999.999,99
  if (!digits) return { display: '', cents: 0 };
  const cents = parseInt(digits, 10);
  const display = (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return { display, cents };
}
