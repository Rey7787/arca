export interface Category {
  id: string;
  profileId: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  color: string; // hex
  archived: boolean; // nunca deleta: arquiva, pra não gerar lançamento órfão
  order: number;
  createdAt: number;
}

export type NewCategory = Omit<Category, 'id' | 'profileId' | 'createdAt' | 'archived' | 'order'>;

/**
 * Categorias iniciais. São sugestões, não regra: todas podem ser renomeadas,
 * recoloridas ou arquivadas. Começar com a tela vazia obriga o usuário a
 * cadastrar antes de lançar qualquer coisa, o que é um péssimo primeiro uso.
 */
export const SEED_CATEGORIES: Array<Pick<Category, 'name' | 'type' | 'color'>> = [
  { name: 'Mercado', type: 'expense', color: '#4fa88b' },
  { name: 'Moradia', type: 'expense', color: '#c8a15a' },
  { name: 'Transporte', type: 'expense', color: '#6f9bd1' },
  { name: 'Saúde', type: 'expense', color: '#d9705f' },
  { name: 'Lazer', type: 'expense', color: '#b07fc9' },
  { name: 'Outros', type: 'both', color: '#8a9a97' },
  { name: 'Salário', type: 'income', color: '#3f9e77' },
];
