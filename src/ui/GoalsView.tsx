import { useState } from 'preact/hooks';
import { registry } from '@/core/registry/ModuleRegistry';
import { formatMoney, maskMoneyInput } from '@/core/types/money';
import { formatMonth } from '@/shared/format';
import type { CategoriesAPI } from '@/modules/categories';
import type { PlanAPI } from '@/modules/plan';
import type { TransactionsAPI } from '@/modules/transactions';

export function GoalsView({ month }: { month: string }) {
  const plan = registry.api<PlanAPI>('plan');
  const categories = registry.api<CategoriesAPI>('categories');
  const transactions = registry.api<TransactionsAPI>('transactions');

  const [, refresh] = useState(0);
  const [editando, setEditando] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // Gasto real por categoria no mês
  const gasto = new Map<string, number>();
  for (const t of transactions.query({ month, type: 'expense' })) {
    gasto.set(t.categoryId, (gasto.get(t.categoryId) ?? 0) + t.amount);
  }

  const linhas = categories
    .list({ type: 'expense' })
    .map((c) => {
      const limite = plan.budgetFor(month, c.id);
      const usado = gasto.get(c.id) ?? 0;
      return { category: c, limite, usado, pct: limite > 0 ? (usado / limite) * 100 : 0 };
    })
    .sort((a, b) => b.pct - a.pct || b.usado - a.usado);

  const comMeta = linhas.filter((l) => l.limite > 0);
  const totalMetas = comMeta.reduce((s, l) => s + l.limite, 0);
  const totalUsado = comMeta.reduce((s, l) => s + l.usado, 0);
  const estourando = comMeta.filter((l) => l.usado > l.limite);

  async function salvar(categoryId: string) {
    await plan.setBudget(month, categoryId, maskMoneyInput(draft).cents);
    setEditando(null);
    setDraft('');
    refresh((n) => n + 1);
  }

  return (
    <>
      <div class="page-head">
        <div>
          <h1>Metas</h1>
          <p class="subtitle" style={{ margin: 0 }}>
            Limite de gasto por categoria em {formatMonth(month)}.
          </p>
        </div>
      </div>

      {comMeta.length > 0 && (
        <div class="stat-grid">
          <div class="stat-card">
            <span class="stat-icon" aria-hidden="true">◎</span>
            <div>
              <div class="total-label">Somatório das metas</div>
              <div class="stat-value">{formatMoney(totalMetas)}</div>
            </div>
          </div>
          <div class={`stat-card ${totalUsado > totalMetas ? 'expense' : ''}`}>
            <span class="stat-icon" aria-hidden="true">↓</span>
            <div>
              <div class="total-label">Gasto nessas categorias</div>
              <div class="stat-value">{formatMoney(totalUsado)}</div>
            </div>
          </div>
        </div>
      )}

      {estourando.length > 0 && (
        <p class="notice bad">
          {estourando.length === 1
            ? `A meta de ${estourando[0]!.category.name} foi ultrapassada.`
            : `${estourando.length} metas foram ultrapassadas neste mês.`}
        </p>
      )}

      <section class="card">
        <h2 class="section-title">Categorias de saída</h2>

        <ul class="goals">
          {linhas.map(({ category, limite, usado, pct }) => (
            <li key={category.id}>
              <div class="goal-head">
                <span class="entry">
                  <i class="dot" style={{ background: category.color }} />
                  {category.name}
                </span>

                {editando === category.id ? (
                  <span class="field-row" style={{ maxWidth: '14rem' }}>
                    <input type="text" inputMode="numeric" placeholder="0,00" autoFocus value={draft}
                      onInput={(e) => setDraft(maskMoneyInput((e.target as HTMLInputElement).value).display)}
                      onKeyDown={(e) => e.key === 'Enter' && void salvar(category.id)} />
                    <button onClick={() => void salvar(category.id)}>Salvar</button>
                  </span>
                ) : (
                  <button class="as-button" style={{ fontSize: '0.95rem' }}
                    onClick={() => {
                      setDraft(limite ? (limite / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
                      setEditando(category.id);
                    }}>
                    {limite > 0 ? `${formatMoney(usado)} de ${formatMoney(limite)}` : 'definir meta'}
                  </button>
                )}
              </div>

              {limite > 0 && (
                <>
                  <div class="goal-bar">
                    <i
                      class={usado > limite ? 'over' : ''}
                      style={{ width: `${Math.min(100, pct)}%`, background: usado > limite ? undefined : category.color }}
                    />
                  </div>
                  <small class={usado > limite ? 'goal-note over' : 'goal-note'}>
                    {usado > limite
                      ? `${formatMoney(usado - limite)} acima da meta`
                      : `restam ${formatMoney(limite - usado)} · ${Math.round(pct)}% usado`}
                  </small>
                </>
              )}
            </li>
          ))}
        </ul>

        <p class="hint">
          As metas valem só para {formatMonth(month)}. Cada mês tem as suas — mude o mês no
          topo da Visão geral para ajustar outro.
        </p>
      </section>
    </>
  );
}
