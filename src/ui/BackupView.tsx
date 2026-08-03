import { useState } from 'preact/hooks';
import { webFileSystem } from '@/core/platform/web';
import { registry } from '@/core/registry/ModuleRegistry';
import { checkPassword } from '@/shared/password';
import { formatTimestamp } from '@/shared/format';
import { BackupError, type BackupAPI, type BackupHeader } from '@/modules/backup';

export function BackupView({ onRestored }: { onRestored: () => void }) {
  const api = registry.api<BackupAPI>('backup');

  const [exportPassword, setExportPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [file, setFile] = useState<Uint8Array | null>(null);
  const [header, setHeader] = useState<BackupHeader | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [confirming, setConfirming] = useState(false);

  const check = checkPassword(exportPassword);

  async function doExport() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api.export(exportPassword);
      setMessage(
        `Backup salvo: ${result.counts['transactions']} lançamentos e ${result.counts['categories']} categorias.`,
      );
      setExportPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o backup.');
    } finally {
      setBusy(false);
    }
  }

  async function pickFile() {
    setError('');
    setMessage('');
    const picked = await webFileSystem.openFile('.arca');
    if (!picked) return;
    try {
      setHeader(api.inspect(picked));
      setFile(picked);
      setConfirming(false);
    } catch (e) {
      setFile(null);
      setHeader(null);
      setError(e instanceof BackupError ? e.message : 'Não foi possível ler o arquivo.');
    }
  }

  async function doRestore() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const counts = await api.restore(file, restorePassword);
      setMessage(`Restaurado: ${counts['transactions']} lançamentos e ${counts['categories']} categorias.`);
      setFile(null);
      setHeader(null);
      setRestorePassword('');
      setConfirming(false);
      onRestored();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível restaurar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div class="page-head">
        <div>
          <h1>Backup</h1>
          <p class="subtitle" style={{ margin: 0 }}>Guarde uma cópia fora deste navegador</p>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title">Gerar backup</h2>
        <p class="hint" style={{ marginTop: 0 }}>
          O arquivo sai cifrado. Escolha a senha dele — pode ser a mesma da Arca ou outra,
          mas sem ela o backup não abre. Não existe recuperação.
        </p>

        <div class="field">
          <label for="bkp-pwd">Senha do backup</label>
          <div class="field-row">
            <input id="bkp-pwd" type={reveal ? 'text' : 'password'} value={exportPassword}
              autocomplete="new-password"
              onInput={(e) => setExportPassword((e.target as HTMLInputElement).value)} />
            <button class="reveal" type="button" onClick={() => setReveal(!reveal)}>
              {reveal ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {exportPassword && !check.valid && <p class="problem">{check.problems[0]}</p>}
        </div>

        <button class="primary" disabled={busy || !check.valid} onClick={doExport}>
          {busy ? 'Gerando…' : 'Salvar backup'}
        </button>
      </div>

      <div class="card">
        <h2 class="section-title">Restaurar</h2>
        <p class="hint" style={{ marginTop: 0 }}>
          A restauração <strong>substitui</strong> todos os lançamentos e categorias deste perfil
          pelos do arquivo. O que estiver aqui agora será perdido.
        </p>

        <button onClick={pickFile}>Escolher arquivo .arca</button>

        {header && (
          <div class="backup-info">
            <div><span>Criado em</span><strong>{formatTimestamp(header.createdAt)}</strong></div>
            <div><span>Lançamentos</span><strong>{header.counts['transactions'] ?? 0}</strong></div>
            <div><span>Categorias</span><strong>{header.counts['categories'] ?? 0}</strong></div>
            <div><span>Formato</span><strong>v{header.formatVersion} · app {header.appVersion}</strong></div>
          </div>
        )}

        {file && (
          <>
            <div class="field" style={{ marginTop: '1rem' }}>
              <label for="rst-pwd">Senha deste backup</label>
              <input id="rst-pwd" type="password" value={restorePassword}
                autocomplete="off"
                onInput={(e) => setRestorePassword((e.target as HTMLInputElement).value)} />
            </div>

            {confirming ? (
              <div class="field-row">
                <button class="danger" disabled={busy} onClick={doRestore}>
                  {busy ? 'Restaurando…' : 'Sim, substituir tudo'}
                </button>
                <button class="ghost" onClick={() => setConfirming(false)}>Cancelar</button>
              </div>
            ) : (
              <button disabled={!restorePassword} onClick={() => setConfirming(true)}>
                Restaurar
              </button>
            )}
          </>
        )}
      </div>

      {message && <p class="notice ok">{message}</p>}
      {error && <p class="notice bad">{error}</p>}
    </>
  );
}
