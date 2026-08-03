import { history } from './HistoryStack';

/**
 * Ctrl+Z / Ctrl+Y (e Cmd+Shift+Z no Mac). Ignora quando o foco está num campo
 * de texto — ali o undo nativo do navegador é o comportamento esperado.
 */
export function installShortcuts(): () => void {
  const handler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
    if (target?.isContentEditable) return;
    if (!(e.ctrlKey || e.metaKey)) return;

    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      void history.undo();
    } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
      e.preventDefault();
      void history.redo();
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
