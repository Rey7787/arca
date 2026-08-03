import { registry } from '@/core/registry/ModuleRegistry';
import { formatMoney } from '@/core/types/money';
import { currentMonth, formatDate, formatMonth, shiftMonth } from '@/shared/format';
import type { CategoriesAPI } from '@/modules/categories';
import type { PlanAPI } from '@/modules/plan';
import type { TransactionsAPI } from '@/modules/transactions';
import { Donut, type Slice } from './Donut';

interface Props {
  month: string;
  onChangeMonth: (month: string) => void;
  onSeeAll: () => void;
}

export function Dashboard({ month, onChangeMonth, onSeeAll }: Props) {
  const api = registry.api<TransactionsAPI>('transactions');
  const categories = registry.api<CategoriesAPI>('categories');
  const plan = registry.api<PlanAPI>('plan');

  const totals = api.totalsByMonth(month);
  const opening = plan.openingBalance(month);
  const available = opening + totals.income - totals.expense;

  const byCategory = new Map<string, number>();
  for (const t of api.query({ month, type: 'expense' })) {
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
  }

  const slices: Slice[] = [...byCategory.entries()]
    .map(([id, value]) => {
      const category = categories.getById(id);
      return { label: category?.name ?? 'Sem categoria', value, color: category?.color ?? '#8a9a97' };
    })
    .sort((a, b) => b.value - a.value);

  const recent = api.query({ month }).slice(0, 5);

  const cards = [
    { label: 'Saldo inicial', value: opening, icon: '▤', tone: 'neutral' },
    { label: 'Entradas', value: totals.income, icon: '↑', tone: 'income' },
    { label: 'Saídas', value: totals.expense, icon: '↓', tone: 'expense' },
    { label: 'Disponível', value: available, icon: '◈', tone: available < 0 ? 'expense' : 'neutral' },
  ];

  return (
    <>
      <div class="page-head">
        <div>
          <h1>Visão geral</h1>
          <p class="subtitle" style={{ margin: 0 }}>
            Resumo das suas finanças em {formatMonth(month)}.
          </p>
        </div>
        <div class="month-picker">
          <button class="icon-button" onClick={() => onChangeMonth(shiftMonth(month, -1))} aria-label="Mês anterior">‹</button>
          <span>{formatMonth(month)}</span>
          <button class="icon-button" onClick={() => onChangeMonth(shiftMonth(month, 1))}
            disabled={month >= currentMonth()} aria-label="Próximo mês">›</button>
        </div>
      </div>

      <div class="stat-grid">
        {cards.map((card) => (
          <div key={card.label} class={`stat-card ${card.tone}`}>
            <span class="stat-icon" aria-hidden="true">{card.icon}</span>
            <div>
              <div class="total-label">{card.label}</div>
              <div class="stat-value">{formatMoney(card.value)}</div>
            </div>
          </div>
        ))}
      </div>

      <div class="panel-grid">
        <section class="card">
          <div class="card-head">
            <h2 class="section-title">Lançamentos recentes</h2>
            <button class="link" onClick={onSeeAll}>Ver todos</button>
          </div>

          <ul class="list">
            {recent.length === 0 && <li class="empty" style={{ display: 'block' }}>Nada lançado neste mês.</li>}
            {recent.map((t) => {
              const category = categories.getById(t.categoryId);
              return (
                <li key={t.id}>
                  <span class="entry">
                    <i class="dot" style={{ background: category?.color ?? 'var(--text-faint)' }} />
                    <span>
                      {t.description}
                      <small class="entry-meta">{formatDate(t.date)} · {category?.name ?? 'sem categoria'}</small>
                    </span>
                  </span>
                  <span class={`amount ${t.type}`}>
                    {t.type === 'expense' ? '−' : '+'}{formatMoney(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section class="card">
          <h2 class="section-title">Saídas por categoria</h2>
          {slices.length === 0 ? (
            <p class="empty">Sem saídas neste mês.</p>
          ) : (
            <div class="donut-row">
              <Donut slices={slices} total={totals.expense} />
              <ul class="legend">
                {slices.map((slice) => (
                  <li key={slice.label}>
                    <i class="dot" style={{ background: slice.color }} />
                    <span>{slice.label}</span>
                    <strong>{formatMoney(slice.value)}</strong>
                    <small>{((slice.value / totals.expense) * 100).toFixed(1)}%</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
