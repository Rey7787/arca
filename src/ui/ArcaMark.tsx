/**
 * A marca da Arca: casco de barco com a casa em cima — a arca de Noé.
 *
 * Desenhada em SVG e não como caractere de fonte: glifo depende da fonte
 * instalada e muda de forma entre sistemas. Aqui a marca é sempre a mesma,
 * e nítida em qualquer tamanho.
 */
export function ArcaMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Arca"
      class="arca-mark"
    >
      {/* água */}
      <path
        d="M3 40c3 0 3-2 6-2s3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2 3 2 6 2"
        stroke="var(--copper)"
        stroke-width="1.6"
        stroke-linecap="round"
        opacity="0.45"
      />

      {/* casco */}
      <path
        d="M5 26h38c0 6.5-5.5 11-19 11S5 32.5 5 26Z"
        fill="var(--copper-dim)"
      />
      {/* faixa de latão na amurada */}
      <path d="M4 24.5h40v3.2H4z" fill="var(--brass)" />

      {/* casa */}
      <path d="M13 16h22v8.5H13z" fill="var(--copper)" />
      {/* telhado */}
      <path d="M24 8l13 7.5H11L24 8Z" fill="var(--brass)" />
      {/* porta */}
      <path d="M22 18.5h4v6h-4z" fill="var(--ink-900)" opacity="0.75" />
    </svg>
  );
}
