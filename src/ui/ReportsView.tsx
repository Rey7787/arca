import { useState } from 'preact/hooks';
import { registry } from '@/core/registry/ModuleRegistry';
import { formatMoney } from '@/core/types/money';
import { formatMonth, shiftMonth } from '@/shared/format';
import { exportCsv, printReport, type ExportRow } from '@/shared/export';
import type { CategoriesAPI } from '@/modules/categories';
import type { TransactionsAPI } from '@/modules/transactions';

const MESES = 6;

export function ReportsView({ month }: { month: string }) {
  const api = registry.api<TransactionsAPI>('transactions');
  const categories = registry.api<CategoriesAPI>('categories');
  const [escopo, setEscopo] = useState<'mes' | 'periodo'>('mes');

  // Últimos 6 meses terminando no mês selecionado
  const meses = Array.from({ length: MESES }, (_, i) => shiftMonth(month, i - (MESES - 1)));
  const serie = meses.map((m) => ({ month: m, ...api.totalsByMonth(m) }));
  const teto = Math.max(1, ...serie.flatMap((s) => [s.income, s.expense]));

  const doPeriodo = escopo === 'periodo';
  const lancamentos = doPeriodo
    ? meses.flatMap((m) => api.query({ month: m }))
    : api.query({ month });

  const totais = lancamentos.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const saldo = totais.income - totais.expense;

  const rows: ExportRow[] = [...lancamentos]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      date: t.date,
      description: t.description,
      category: categories.getById(t.categoryId)?.name ?? 'sem categoria',
      type: t.type,
      amountCents: t.amount,
    }));

  const periodoLabel = doPeriodo
    ? `${formatMonth(meses[0]!)} a ${formatMonth(month)}`
    : formatMonth(month);

  // Média mensal só faz sentido sobre meses que já aconteceram
  const mesesComDados = serie.filter((s) => s.income > 0 || s.expense > 0);
  const mediaSaidas = mesesComDados.length
    ? Math.round(mesesComDados.reduce((sum, s) => sum + s.expense, 0) / mesesComDados.length)
    : 0;

  return (
    <>
      <div class="page-head">
        <div>
          <h1>Relatórios</h1>
          <p class="subtitle" style={{ margin: 0 }}>Seis meses até {formatMonth(month)}.</p>
        </div>
      </div>

      <section class="card">
        <h2 class="section-title">Entradas e saídas por mês</h2>
        <div class="bars">
          {serie.map((s) => (
            <div class="bar-group" key={s.month}>
              <div class="bar-pair">
                <i class="bar income" style={{ height: `${(s.income / teto) * 100}%` }}
                  title={`Entradas: ${formatMoney(s.income)}`} />
                <i class="bar expense" style={{ height: `${(s.expense / teto) * 100}%` }}
                  title={`Saídas: ${formatMoney(s.expense)}`} />
              </div>
              <small class={s.month === month ? 'atual' : ''}>
                {formatMonth(s.month).slice(0, 3)}
              </small>
            </div>
          ))}
        </div>
        <div class="legend-inline">
          <span><i class="dot" style={{ background: 'var(--copper)' }} /> Entradas</span>
          <span><i class="dot" style={{ background: 'var(--alert)' }} /> Saídas</span>
        </div>
        {mediaSaidas > 0 && (
          <p class="hint">
            Média de saídas nos meses com movimento: <strong>{formatMoney(mediaSaidas)}</strong>.
          </p>
        )}
      </section>

      <section class="card">
        <div class="card-head">
          <h2 class="section-title">Exportar</h2>
          <select value={escopo} onChange={(e) => setEscopo((e.target as HTMLSelectElement).value as 'mes' | 'periodo')}>
            <option value="mes">Só {formatMonth(month)}</option>
            <option value="periodo">Últimos {MESES} meses</option>
          </select>
        </div>

        <p class="hint" style={{ marginTop: 0 }}>
          {rows.length} lançamento(s) no período · saldo {formatMoney(saldo)}
        </p>

        <div class="field-row">
          <button onClick={() => void exportCsv(`arca-${doPeriodo ? 'periodo' : month}.csv`, rows)}>
            Baixar CSV
          </button>
          <button onClick={() =>
            printReport({
              title: `Arca — ${periodoLabel}`,
              subtitle: periodoLabel,
              rows,
              totals: { ...totais, balance: saldo },
            })
          }>
            Gerar PDF
          </button>
        </div>

        <p class="hint">
          O PDF abre no diálogo de impressão — escolha <strong>Salvar como PDF</strong> no destino.
          O CSV usa ponto e vírgula, que é o formato que o Excel em português abre direto.
        </p>
      </section>
    </>
  );
}
