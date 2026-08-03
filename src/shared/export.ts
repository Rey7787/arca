import { webFileSystem } from '@/core/platform/web';
import { formatMoney } from '@/core/types/money';
import { formatDate } from '@/shared/format';

export interface ExportRow {
  date: string;
  description: string;
  category: string;
  type: 'income' | 'expense';
  amountCents: number;
}

/**
 * CSV com ponto e vírgula e BOM: é o que o Excel em português abre direto,
 * sem passar pelo assistente de importação.
 */
export async function exportCsv(filename: string, rows: ExportRow[]): Promise<void> {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const linhas = [
    ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'].join(';'),
    ...rows.map((r) =>
      [
        escape(formatDate(r.date)),
        escape(r.description),
        escape(r.category),
        escape(r.type === 'income' ? 'Entrada' : 'Saída'),
        // vírgula decimal, como o Excel pt-BR espera
        escape((r.amountCents / 100).toFixed(2).replace('.', ',')),
      ].join(';'),
    ),
  ];

  const bom = '\uFEFF';
  const bytes = new TextEncoder().encode(bom + linhas.join('\r\n'));
  await webFileSystem.saveFile(filename, bytes, 'text/csv');
}

/**
 * PDF pela impressão do próprio navegador.
 *
 * jsPDF traria 300+ KB e desenharia o relatório pixel a pixel. O motor de
 * impressão do navegador já faz isso melhor, respeita margem e paginação, e
 * não custa nada em peso. O usuário escolhe "Salvar como PDF" no diálogo.
 */
export function printReport(options: {
  title: string;
  subtitle: string;
  rows: ExportRow[];
  totals: { income: number; expense: number; balance: number };
}): void {
  const { title, subtitle, rows, totals } = options;

  const linhas = rows
    .map(
      (r) => `<tr>
        <td>${formatDate(r.date)}</td>
        <td>${escapeHtml(r.description)}</td>
        <td>${escapeHtml(r.category)}</td>
        <td class="num ${r.type}">${r.type === 'expense' ? '−' : '+'}${formatMoney(r.amountCents)}</td>
      </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 18mm 14mm; }
  body { font-family: system-ui, sans-serif; color: #111; font-size: 11pt; }
  h1 { font-size: 16pt; margin: 0; letter-spacing: 0.18em; }
  .sub { color: #666; margin: 2mm 0 8mm; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9pt; text-transform: uppercase;
       letter-spacing: 0.08em; color: #666; border-bottom: 1px solid #ccc; padding: 2mm 1mm; }
  td { padding: 2mm 1mm; border-bottom: 1px solid #eee; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .expense { color: #a8452f; } .income { color: #2c6d58; }
  tfoot td { border-top: 2px solid #333; border-bottom: none; font-weight: 600; padding-top: 3mm; }
  .rodape { margin-top: 8mm; color: #888; font-size: 8pt; }
</style></head>
<body>
  <h1>ARCA</h1>
  <div class="sub">${escapeHtml(subtitle)}</div>
  <table>
    <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead>
    <tbody>${linhas || '<tr><td colspan="4">Nenhum lançamento no período.</td></tr>'}</tbody>
    <tfoot>
      <tr><td colspan="3">Entradas</td><td class="num income">${formatMoney(totals.income)}</td></tr>
      <tr><td colspan="3">Saídas</td><td class="num expense">${formatMoney(totals.expense)}</td></tr>
      <tr><td colspan="3">Saldo do período</td><td class="num">${formatMoney(totals.balance)}</td></tr>
    </tfoot>
  </table>
  <div class="rodape">Gerado pela Arca — os dados nunca saíram deste dispositivo.</div>
</body></html>`;

  const janela = window.open('', '_blank');
  if (!janela) return;
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  janela.print();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
