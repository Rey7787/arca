import type { Money } from '@/core/types/money';

/**
 * Um lançamento que se repete todo mês — aluguel, salário, mensalidade.
 *
 * A recorrência é só o MOLDE. Ela não vira lançamento sozinha: você aperta
 * "Lançar no mês" e ela gera. App que grava sem pedir é app em que não se
 * confia, e o gerado ainda é desfazível.
 */
export interface Recurrence {
  id: string;
  profileId: string;
  description: string;
  amount: Money;
  type: 'income' | 'expense';
  categoryId: string;
  dayOfMonth: number; // 1–31; meses curtos usam o último dia
  active: boolean;
  createdAt: number;
}

export type NewRecurrence = Omit<Recurrence, 'id' | 'profileId' | 'active' | 'createdAt'>;
