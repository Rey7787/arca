import { useState } from 'preact/hooks';
import { registry } from '@/core/registry/ModuleRegistry';
import { formatMoney, maskMoneyInput } from '@/core/types/money';
import { formatMonth } from '@/shared/format';
import type { CategoriesAPI } from '@/modules/categories';
import type { RecurrencesAPI } from '@/modules/recurrences';

export function RecurrencesView({ month }: { month: string }) {
  const api = registry.api<RecurrencesAPI>('recurrences');
  const categories = registry.api<CategoriesAPI>('categories');

  const [, refresh] = useState(0);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [cents, setCents] = useState(0);
  const [day, setDay] = useState(5);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [message, setMessage] = useState('');

  const lista = api.list();
  const pendentes = api.pendingFor(month);
  const categoryList = categories.list();
  const activeCategoryId = categoryId || categoryList[0]?.id || '';

  async function add() {
    if (!description.trim() || cents <= 0) return;
    await api.create({
      description: description.trim(),
      amount: cents,
      type,
      categoryId: activeCategoryId,
      dayOfMonth: day,
    });
    setDescription('');
    setAmount('');
    setCents(0);
    refresh((n) => n + 1);
  }

  async function aplicar() {
    const quantos = await api.applyTo(month);
    setMessage(
      quantos === 0
        ? 'Nada pendente — todas já foram lançadas neste mês.'
        : `${quantos} lançamento(s) gerado(s). Pode desfazer com Ctrl+Z.`,
    );
    refresh((n) => n + 1);
  }

  return (
    <>
      <div class="page-head">
        <div>
          <h1>Recorrentes</h1>
          <p class="subtitle" style={{ margin: 0 }}>
            Aluguel, salário, mensalidade — o molde fica aqui e você lança quando quiser.
          </p>
        </div>
      </div>

      <section class="card">
        <div class="card-head">
          <h2 class="section-title">Pendentes em {formatMonth(month)}</h2>
          <button disabled={pendentes.length === 0} onClick={aplicar}>
            Lançar {pendentes.length > 0 ? `(${pendentes.length})` : ''}
          </button>
        </div>

        {pendentes.length === 0 ? (
          <p class="hint" style={{ marginTop: 0 }}>
            Tudo em dia neste mês.
          </p>
        ) : (
          <ul class="list">
            {pendentes.map((r) => (
              <li key={r.id}>
                <span class="entry">
                  <i class="dot" style={{ background: categories.getById(r.categoryId)?.color ?? 'var(--text-faint)' }} />
                  <span>
                    {r.description}
                    <small class="entry-meta">todo dia {r.dayOfMonth}</small>
                  </span>
                </span>
                <span class={`amount ${r.type}`}>
                  {r.type === 'expense' ? '−' : '+'}{formatMoney(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {message && <p class="notice ok">{message}</p>}
      </section>

      <section class="card">
        <h2 class="section-title">Nova recorrência</h2>

        <div class="field">
          <label for="rec-desc">Descrição</label>
          <input id="rec-desc" type="text" value={description}
            onInput={(e) => setDescription((e.target as HTMLInputElement).value)} />
        </div>

        <div class="grid-3">
          <div class="field">
            <label for="rec-valor">Valor</label>
            <input id="rec-valor" type="text" inputMode="numeric" placeholder="0,00" value={amount}
              onInput={(e) => {
                const masked = maskMoneyInput((e.target as HTMLInputElement).value);
                setAmount(masked.display);
                setCents(masked.cents);
              }} />
          </div>
          <div class="field">
            <label for="rec-dia">Dia do mês</label>
            <select id="rec-dia" value={String(day)}
              onChange={(e) => setDay(Number((e.target as HTMLSelectElement).value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>{d}</option>
              ))}
            </select>
          </div>
          <div class="field">
            <label for="rec-cat">Categoria</label>
            <select id="rec-cat" value={activeCategoryId}
              onChange={(e) => setCategoryId((e.target as HTMLSelectElement).value)}>
              {categoryList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div class="field-row">
          <select value={type} onChange={(e) => setType((e.target as HTMLSelectElement).value as 'income' | 'expense')}>
            <option value="expense">Saída</option>
            <option value="income">Entrada</option>
          </select>
          <button class="primary" disabled={!description.trim() || cents <= 0} onClick={add}>
            Criar recorrência
          </button>
        </div>

        <p class="hint">
          Dia 31 em meses curtos vira o último dia do mês — não escorrega para o mês seguinte.
        </p>
      </section>

      {lista.length > 0 && (
        <section class="card">
          <h2 class="section-title">Todas as recorrências</h2>
          <ul class="list">
            {lista.map((r) => (
              <li key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                <span class="entry">
                  <i class="dot" style={{ background: categories.getById(r.categoryId)?.color ?? 'var(--text-faint)' }} />
                  <span>
                    {r.description}
                    <small class="entry-meta">
                      dia {r.dayOfMonth} · {categories.getById(r.categoryId)?.name ?? 'sem categoria'}
                    </small>
                  </span>
                </span>
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span class={`amount ${r.type}`}>
                    {r.type === 'expense' ? '−' : '+'}{formatMoney(r.amount)}
                  </span>
                  <button class="ghost" onClick={async () => { await api.setActive(r.id, !r.active); refresh((n) => n + 1); }}>
                    {r.active ? 'Pausar' : 'Reativar'}
                  </button>
                  <button class="ghost" onClick={async () => { await api.remove(r.id); refresh((n) => n + 1); }}>
                    Excluir
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
