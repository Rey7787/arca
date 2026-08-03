import type { Money } from '@/core/types/money';

export interface Transaction {
  id: string;
  profileId: string;
  type: 'income' | 'expense';
  amount: Money;
  date: string; // "2026-08-01"
  categoryId: string;
  description: string;
  notes?: string;
  /** Preenchido quando o lançamento veio de uma recorrência. */
  recurrenceId?: string;
  deletedAt?: number; // soft delete: é o que sustenta o undo de exclusão
  createdAt: number;
  updatedAt: number;
}

export type NewTransaction = Omit<
  Transaction,
  'id' | 'profileId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export interface TransactionFilter {
  month?: string; // "2026-08"
  type?: 'income' | 'expense';
  categoryId?: string;
  search?: string;
}
