import { useState } from 'preact/hooks';
import { registry } from '@/core/registry/ModuleRegistry';
import type { CategoriesAPI, Category } from '@/modules/categories';

const PALETTE = ['#4fa88b', '#c8a15a', '#6f9bd1', '#d9705f', '#b07fc9', '#3f9e77', '#8a9a97'];

export function CategoriesView() {
  const api = registry.api<CategoriesAPI>('categories');
  const [, refresh] = useState(0);
  const [name, setName] = useState('');
  const [type, setType] = useState<Category['type']>('expense');
  const [color, setColor] = useState(PALETTE[0]!);
  const [showArchived, setShowArchived] = useState(false);

  const categories = api.list({ includeArchived: showArchived });

  async function add() {
    if (!name.trim()) return;
    await api.create({ name: name.trim(), type, color });
    setName('');
    refresh((n) => n + 1);
  }

  async function rename(category: Category) {
    const next = prompt('Novo nome da categoria', category.name);
    if (!next?.trim() || next === category.name) return;
    await api.update(category.id, { name: next.trim() });
    refresh((n) => n + 1);
  }

  return (
    <>
      <div class="page-head">
        <div>
          <h1>Categorias</h1>
          <p class="subtitle" style={{ margin: 0 }}>Renomeie, recolora ou arquive</p>
        </div>
      </div>

      <div class="field">
        <label for="cat-name">Nova categoria</label>
        <div class="field-row">
          <input id="cat-name" type="text" value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()} />
          <select value={type} onChange={(e) => setType((e.target as HTMLSelectElement).value as Category['type'])}>
            <option value="expense">Saída</option>
            <option value="income">Entrada</option>
            <option value="both">Ambos</option>
          </select>
          <button onClick={add} disabled={!name.trim()}>Criar</button>
        </div>
        <div class="swatches">
          {PALETTE.map((c) => (
            <button key={c} class={`swatch ${c === color ? 'selected' : ''}`}
              style={{ background: c }} aria-label={`Cor ${c}`} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>

      <ul class="list">
        {categories.map((c) => (
          <li key={c.id} style={{ opacity: c.archived ? 0.5 : 1 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <i class="dot" style={{ background: c.color }} />
              {c.name}
              <small class="tag">
                {c.type === 'expense' ? 'saída' : c.type === 'income' ? 'entrada' : 'ambos'}
              </small>
            </span>
            <span style={{ display: 'flex', gap: '0.5rem' }}>
              <button class="ghost" onClick={() => rename(c)}>Renomear</button>
              <button class="ghost" onClick={async () => { await api.setArchived(c.id, !c.archived); refresh((n) => n + 1); }}>
                {c.archived ? 'Reativar' : 'Arquivar'}
              </button>
            </span>
          </li>
        ))}
      </ul>

      <button class="ghost" onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? 'Ocultar arquivadas' : 'Mostrar arquivadas'}
      </button>
    </>
  );
}
