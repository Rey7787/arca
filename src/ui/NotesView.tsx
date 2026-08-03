import { useState } from 'preact/hooks';
import { registry } from '@/core/registry/ModuleRegistry';
import { formatTimestamp } from '@/shared/format';
import type { NotesAPI } from '@/modules/notes';

export function NotesView() {
  const api = registry.api<NotesAPI>('notes');
  const [, refresh] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const notes = api.list();

  async function add() {
    if (!title.trim()) return;
    await api.create(title.trim(), content.trim());
    setTitle('');
    setContent('');
    refresh((n) => n + 1);
  }

  return (
    <>
      <div class="page-head">
        <div>
          <h1>Anotações</h1>
          <p class="subtitle" style={{ margin: 0 }}>
            Guardadas cifradas, junto com o resto.
          </p>
        </div>
      </div>

      <section class="card">
        <div class="field">
          <label for="nota-titulo">Título</label>
          <input id="nota-titulo" type="text" value={title}
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        </div>
        <div class="field">
          <label for="nota-texto">Texto</label>
          <textarea id="nota-texto" rows={4} value={content}
            onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)} />
        </div>
        <button class="primary" disabled={!title.trim()} onClick={add}>Salvar anotação</button>
      </section>

      <div class="notes-grid">
        {notes.length === 0 && <p class="empty">Nenhuma anotação ainda.</p>}
        {notes.map((note) => (
          <article class={`card note ${note.pinned ? 'pinned' : ''}`} key={note.id}>
            <div class="card-head">
              <h3>{note.title}</h3>
              <button class="ghost" title={note.pinned ? 'Desafixar' : 'Fixar no topo'}
                onClick={async () => { await api.update(note.id, { pinned: !note.pinned }); refresh((n) => n + 1); }}>
                {note.pinned ? '★' : '☆'}
              </button>
            </div>
            {note.content && <p class="note-body">{note.content}</p>}
            <footer class="note-foot">
              <small>{formatTimestamp(note.updatedAt)}</small>
              <button class="ghost" onClick={async () => { await api.remove(note.id); refresh((n) => n + 1); }}>
                Excluir
              </button>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
