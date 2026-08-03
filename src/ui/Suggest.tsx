import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * Autocompletar próprio. O <datalist> nativo não aceita estilo.
 *
 * Cada linha carrega informação real — categoria e último valor lançado —
 * porque é isso que torna a lista útil: você reconhece o lançamento antes de
 * escolher, em vez de ler só um texto repetido.
 *
 * Casa sem acento e sem diferenciar maiúscula: "farmacia" encontra "Farmácia".
 */
const fold = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export interface SuggestOption {
  text: string;
  meta?: string; // "Saúde · R$ 27,45"
  color?: string;
}

interface Props {
  id: string;
  value: string;
  options: SuggestOption[];
  onInput: (value: string) => void;
  placeholder?: string;
}

export function Suggest({ id, value, options, onInput, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);

  const needle = fold(value.trim());
  const matches = (needle
    ? options.filter((o) => fold(o.text).includes(needle) && fold(o.text) !== needle)
    : options
  ).slice(0, 6);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function choose(option: SuggestOption) {
    onInput(option.text);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((active + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((active - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter' && matches[active]) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  /** Destaca o trecho que casou com o que foi digitado. */
  function highlight(text: string) {
    if (!needle) return text;
    const start = fold(text).indexOf(needle);
    if (start < 0) return text;
    return (
      <>
        {text.slice(0, start)}
        <mark>{text.slice(start, start + needle.length)}</mark>
        {text.slice(start + needle.length)}
      </>
    );
  }

  return (
    <div class="suggest" ref={wrapper}>
      <input
        id={id}
        type="text"
        spellcheck
        lang="pt-BR"
        autocomplete="off"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={`${id}-list`}
        placeholder={placeholder}
        value={value}
        onInput={(e) => {
          onInput((e.target as HTMLInputElement).value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && matches.length > 0 && (
        <div class="suggest-panel">
          <ul class="suggest-list" id={`${id}-list`} role="listbox">
            {matches.map((option, i) => (
              <li
                key={option.text}
                role="option"
                aria-selected={i === active}
                class={i === active ? 'active' : ''}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(option)}
              >
                <i class="dot" style={{ background: option.color ?? 'var(--text-faint)' }} />
                <span class="suggest-text">
                  <strong>{highlight(option.text)}</strong>
                  {option.meta && <small>{option.meta}</small>}
                </span>
                <kbd class="enter-hint" aria-hidden="true">↵</kbd>
              </li>
            ))}
          </ul>
          <footer class="suggest-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
            <span><kbd>↵</kbd> usar</span>
            <span><kbd>esc</kbd> fechar</span>
          </footer>
        </div>
      )}
    </div>
  );
}
