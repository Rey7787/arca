import type { ComponentChildren } from 'preact';
import { ArcaMark } from './ArcaMark';
import { Clock } from './Clock';

export type ViewId =
  | 'dashboard'
  | 'transactions'
  | 'recurrences'
  | 'categories'
  | 'reports'
  | 'notes'
  | 'backup'
  | 'settings';

interface NavItem {
  id: ViewId | null; // null = ainda não existe
  label: string;
  icon: string;
}

/**
 * Itens sem tela ainda aparecem marcados como "em breve" em vez de sumirem
 * ou levarem a lugar nenhum. Menu que promete o que não entrega é pior que
 * menu curto.
 */
const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Visão geral', icon: '◱' },
  { id: 'transactions', label: 'Lançamentos', icon: '≡' },
  { id: 'recurrences', label: 'Recorrentes', icon: '↻' },
  { id: 'categories', label: 'Categorias', icon: '◈' },
  { id: 'reports', label: 'Relatórios', icon: '◔' },
  { id: 'notes', label: 'Anotações', icon: '❏' },
  { id: null, label: 'Metas', icon: '◎' },
  { id: 'backup', label: 'Backup', icon: '⛁' },
  { id: 'settings', label: 'Configurações', icon: '⚙' },
];

interface Props {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  onLock: () => void;
  children: ComponentChildren;
}

export function Shell({ view, onNavigate, onLock, children }: Props) {
  return (
    <div class="shell-grid">
      <aside class="sidebar">
        <div class="brand">
          <ArcaMark size={38} />
          <span>
            <strong>ARCA</strong>
            <small>Gerenciador financeiro</small>
          </span>
        </div>

        <nav>
          {NAV.map((item) => (
            <button
              key={item.label}
              class={`nav-item ${item.id === view ? 'active' : ''} ${item.id ? '' : 'soon'}`}
              disabled={!item.id}
              onClick={() => item.id && onNavigate(item.id)}
            >
              <span class="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
              {!item.id && <small class="soon-tag">em breve</small>}
            </button>
          ))}
        </nav>

        <div class="privacy-note">
          <strong>Criptografia local ativa</strong>
          <small>Seus dados ficam neste dispositivo e nunca são enviados para servidores.</small>
        </div>
      </aside>

      <main class="content">
        <header class="content-head">
          <div class="head-actions">
            <Clock />
            <button class="ghost" onClick={onLock}>Bloquear</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
