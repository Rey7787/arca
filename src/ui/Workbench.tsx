import { useEffect, useState } from 'preact/hooks';
import { bus } from '@/core/events/bus';
import { history } from '@/core/history/HistoryStack';
import { registry } from '@/core/registry/ModuleRegistry';
import { formatMoney, maskMoneyInput } from '@/core/types/money';
import { currentMonth, firstDayOf, formatDate, formatMonth, shiftMonth, today } from '@/shared/format';
import { Suggest } from './Suggest';
import type { CategoriesAPI } from '@/modules/categories';
import type { PlanAPI } from '@/modules/plan';
import type { Transaction, TransactionsAPI } from '@/modules/transactions';

export function Workbench({ month, onChangeMonth }: { month: string; onChangeMonth: (month: string) => void }) {
  const api = registry.api<TransactionsAPI>('transactions');
  const categories = registry.api<CategoriesAPI>('categories');
  const plan = registry.api<PlanAPI>('plan');

  const [, refresh] = useState(0);
  const rerender = () => refresh((n) => n + 1);

  // Formulário
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [cents, setCents] = useState(0);
  const [date, setDate] = useState(today());
  const [categoryId, setCategoryId] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'' | 'income' | 'expense'>('');
  const [filterCategory, setFilterCategory] = useState('');

  // Saldo inicial
  const [openingDraft, setOpeningDraft] = useState('');
  const [editingOpening, setEditingOpening] = useState(false);

  // Toast: aparece logo após a ação e some sozinho. O Ctrl+Z continua
  // funcionando depois que ele some — o histórico não depende do toast.
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const showToast = () => {
      rerender();
      setToast(history.nextUndoLabel);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 5000);
    };

    const offs = [
      bus.on('history:changed', showToast),
      bus.on('category:changed', rerender),
      bus.on('plan:changed', rerender),
    ];
    return () => {
      clearTimeout(timer);
      offs.forEach((off) => off());
    };
  }, []);

  // Ao trocar de mês, a data padrão do formulário acompanha
  useEffect(() => {
    setDate(month === currentMonth() ? today() : firstDayOf(month));
  }, [month]);

  const filters = {
    month,
    ...(filterType ? { type: filterType } : {}),
    ...(filterCategory ? { categoryId: filterCategory } : {}),
    ...(search ? { search } : {}),
  };
  const transactions = api.query(filters);
  const totals = api.totalsByMonth(month);
  const opening = plan.openingBalance(month);
  const available = opening + totals.income - totals.expense;

  // Autocompletar: descrições já usadas, das mais frequentes pras menos.
  // Cada sugestão carrega a categoria e o último valor — reconhecer o
  // lançamento vale mais que ler o texto repetido.
  const suggestions = (() => {
    const seen = new Map<string, { count: number; last: Transaction }>();
    for (const t of api.query({})) {
      const entry = seen.get(t.description);
      if (!entry) seen.set(t.description, { count: 1, last: t });
      else {
        entry.count += 1;
        if (t.date > entry.last.date) entry.last = t;
      }
    }
    return [...seen.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, 50)
      .map(([text, { last }]) => {
        const category = categories.getById(last.categoryId);
        return {
          text,
          meta: `${category?.name ?? 'sem categoria'} · ${formatMoney(last.amount)}`,
          ...(category?.color ? { color: category.color } : {}),
        };
      });
  })();

  const categoryList = categories.list();
  const activeCategoryId = categoryId || categoryList[0]?.id || '';

  function resetForm() {
    setDescription('');
    setAmount('');
    setCents(0);
    setEditing(null);
    setDate(month === currentMonth() ? today() : firstDayOf(month));
  }

  async function submit(type: 'income' | 'expense') {
    if (cents <= 0 || !description.trim()) return;

    if (editing) {
      await api.update(editing.id, {
        type, amount: cents, date, categoryId: activeCategoryId,
        description: description.trim(),
      });
    } else {
      await api.create({
        type, amount: cents, date, categoryId: activeCategoryId,
        description: description.trim(),
      });
    }
    resetForm();
    rerender();
  }

  function startEdit(t: Transaction) {
    setEditing(t);
    setDescription(t.description);
    setCents(t.amount);
    setAmount((t.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setDate(t.date);
    setCategoryId(t.categoryId);
  }

  async function saveOpening() {
    await plan.setOpeningBalance(month, maskMoneyInput(openingDraft).cents);
    setEditingOpening(false);
    rerender();
  }

  return (
    <>
      <div class="page-head">
        <div>
          <h1>Lançamentos</h1>
          <p class="subtitle" style={{ margin: 0 }}>{formatMonth(month)}</p>
        </div>
        <div class="month-picker">
          <button class="icon-button" onClick={() => onChangeMonth(shiftMonth(month, -1))} aria-label="Mês anterior">‹</button>
          <span>{formatMonth(month)}</span>
          <button class="icon-button" onClick={() => onChangeMonth(shiftMonth(month, 1))} aria-label="Próximo mês">›</button>
        </div>
      </div>

      <div class="totals">
        <div>
          <div class="total-label">Saldo inicial</div>
          {editingOpening ? (
            <div class="field-row">
              <input type="text" inputMode="numeric" placeholder="0,00" autoFocus
                value={openingDraft}
                onInput={(e) => setOpeningDraft(maskMoneyInput((e.target as HTMLInputElement).value).display)}
                onKeyDown={(e) => e.key === 'Enter' && void saveOpening()} />
              <button onClick={saveOpening}>Salvar</button>
            </div>
          ) : (
            <button class="total-value as-button"
              onClick={() => {
                setOpeningDraft(opening ? (opening / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
                setEditingOpening(true);
              }}>
              {opening ? formatMoney(opening) : 'definir'}
            </button>
          )}
        </div>
        <div>
          <div class="total-label">Entradas</div>
          <div class="total-value income">{formatMoney(totals.income)}</div>
        </div>
        <div>
          <div class="total-label">Saídas</div>
          <div class="total-value expense">{formatMoney(totals.expense)}</div>
        </div>
        <div>
          <div class="total-label">Disponível</div>
          <div class="total-value" style={{ color: available < 0 ? 'var(--alert)' : undefined }}>
            {formatMoney(available)}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="field">
          <label for="desc">{editing ? 'Editando lançamento' : 'Descrição'}</label>
          <Suggest
            id="desc"
            value={description}
            options={suggestions}
            onInput={setDescription}
          />
        </div>

        <div class="grid-3">
          <div class="field">
            <label for="amt">Valor</label>
            <input id="amt" type="text" inputMode="numeric" placeholder="0,00" value={amount}
              onInput={(e) => {
                const masked = maskMoneyInput((e.target as HTMLInputElement).value);
                setAmount(masked.display);
                setCents(masked.cents);
              }} />
          </div>
          <div class="field">
            <label for="date">Data</label>
            <input id="date" type="date" value={date}
              onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <label for="cat">Categoria</label>
            <select id="cat" value={activeCategoryId}
              onChange={(e) => setCategoryId((e.target as HTMLSelectElement).value)}>
              {categoryList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div class="field-row">
          <button disabled={cents <= 0 || !description.trim()} onClick={() => submit('expense')}>
            {editing ? 'Salvar como saída' : 'Saída'}
          </button>
          <button disabled={cents <= 0 || !description.trim()} onClick={() => submit('income')}>
            {editing ? 'Salvar como entrada' : 'Entrada'}
          </button>
          {editing && <button class="ghost" onClick={resetForm}>Cancelar</button>}
        </div>
      </div>

      <div class="filters">
        <input type="search" placeholder="Buscar na descrição" value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
        <select value={filterType} onChange={(e) => setFilterType((e.target as HTMLSelectElement).value as '' | 'income' | 'expense')}>
          <option value="">Tudo</option>
          <option value="expense">Só saídas</option>
          <option value="income">Só entradas</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory((e.target as HTMLSelectElement).value)}>
          <option value="">Todas categorias</option>
          {categories.list({ includeArchived: true }).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <ul class="list">
        {transactions.length === 0 && (
          <li class="empty" style={{ display: 'block' }}>
            {search || filterType || filterCategory
              ? 'Nenhum lançamento com esses filtros.'
              : 'Nada lançado neste mês ainda.'}
          </li>
        )}
        {transactions.map((t) => {
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
              <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span class={`amount ${t.type}`}>
                  {t.type === 'expense' ? '−' : '+'}{formatMoney(t.amount)}
                </span>
                <button class="ghost" onClick={() => startEdit(t)}>Editar</button>
                <button class="ghost" onClick={() => void api.remove(t.id)}>Excluir</button>
              </span>
            </li>
          );
        })}
      </ul>

      {toast && history.canUndo && (
        <div class="toast" role="status">
          <span>{toast}</span>
          <button onClick={() => { void history.undo(); setToast(null); }}>Desfazer</button>
        </div>
      )}
    </>
  );
}
