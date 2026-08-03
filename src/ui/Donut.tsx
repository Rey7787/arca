import { formatMoney, type Money } from '@/core/types/money';

export interface Slice {
  label: string;
  value: Money;
  color: string;
}

/**
 * Rosca em SVG puro — nenhuma biblioteca de gráfico. São ~40 linhas de
 * trigonometria contra ~200 KB de Chart.js, num app que precisa abrir offline.
 */
export function Donut({ slices, total }: { slices: Slice[]; total: Money }) {
  const size = 180;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div class="donut">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Saídas por categoria">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--border)" stroke-width={stroke} />
        {total > 0 && slices.map((slice) => {
          const fraction = slice.value / total;
          const dash = fraction * circumference;
          const element = (
            <circle
              key={slice.label}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={slice.color} stroke-width={stroke}
              stroke-dasharray={`${dash} ${circumference - dash}`}
              stroke-dashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += dash;
          return element;
        })}
      </svg>
      <div class="donut-center">
        <small>Total de saídas</small>
        <strong>{formatMoney(total)}</strong>
      </div>
    </div>
  );
}
