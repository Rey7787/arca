import { useEffect, useState } from 'preact/hooks';
import {
  changePassword,
  getIdleMinutes,
  IDLE_OPTIONS,
  regenerateRecoveryCode,
  setIdleMinutes,
} from '@/modules/auth/service';
import { checkPassword } from '@/shared/password';

export function SettingsView({ profileId }: { profileId: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [idle, setIdle] = useState(30);
  useEffect(() => { void getIdleMinutes(profileId).then(setIdle); }, [profileId]);

  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [newCode, setNewCode] = useState('');

  const check = checkPassword(next);
  const matches = next.length > 0 && next === confirm;

  async function doChange() {
    setBusy(true); setError(''); setMessage('');
    try {
      const ok = await changePassword(profileId, current, next);
      if (!ok) setError('Senha atual incorreta.');
      else {
        setMessage('Senha alterada. Os dados não foram reprocessados — só a chave mestra foi recifrada.');
        setCurrent(''); setNext(''); setConfirm('');
      }
    } finally { setBusy(false); }
  }

  async function doRegenerate() {
    setBusy(true); setError(''); setMessage(''); setNewCode('');
    try {
      const code = await regenerateRecoveryCode(profileId, recoveryPassword);
      if (!code) setError('Senha incorreta.');
      else { setNewCode(code); setRecoveryPassword(''); }
    } finally { setBusy(false); }
  }

  return (
    <>
      <div class="page-head">
        <div>
          <h1>Configurações</h1>
          <p class="subtitle" style={{ margin: 0 }}>Senha e recuperação de acesso.</p>
        </div>
      </div>

      <div class="panel-grid">
        <section class="card">
          <h2 class="section-title">Bloqueio automático</h2>
          <p class="hint" style={{ marginTop: 0 }}>
            Tempo sem clique ou tecla até a Arca se trancar sozinha. Qualquer ação
            reinicia a contagem. Fechar a aba tranca na hora, independente disso.
          </p>
          <div class="field-row">
            <select value={String(idle)} onChange={async (e) => {
              const minutes = Number((e.target as HTMLSelectElement).value);
              setIdle(minutes);
              await setIdleMinutes(profileId, minutes);
            }}>
              {IDLE_OPTIONS.map((m) => (
                <option key={m} value={String(m)}>{m} minutos</option>
              ))}
            </select>
          </div>
          <p class="hint">
            Mais tempo é mais confortável e também mais tempo com a Arca aberta
            se você esquecer o computador desbloqueado.
          </p>
        </section>

        <section class="card">
          <h2 class="section-title">Trocar senha</h2>
          <p class="hint" style={{ marginTop: 0 }}>
            Só a chave mestra é recifrada — seus lançamentos não são reprocessados.
            Backups antigos continuam abrindo com a senha que tinham quando foram gerados.
          </p>

          <div class="field">
            <label for="cur">Senha atual</label>
            <input id="cur" type="password" value={current} autocomplete="current-password"
              onInput={(e) => setCurrent((e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <label for="new">Nova senha</label>
            <input id="new" type="password" value={next} autocomplete="new-password"
              onInput={(e) => setNext((e.target as HTMLInputElement).value)} />
            {next && !check.valid && <p class="problem">{check.problems[0]}</p>}
          </div>
          <div class="field">
            <label for="cfm">Repita a nova senha</label>
            <input id="cfm" type="password" value={confirm} autocomplete="new-password"
              onInput={(e) => setConfirm((e.target as HTMLInputElement).value)} />
            {confirm && !matches && <p class="problem">As senhas não conferem.</p>}
          </div>

          <button class="primary" disabled={busy || !current || !check.valid || !matches} onClick={doChange}>
            {busy ? 'Trocando…' : 'Trocar senha'}
          </button>
        </section>

        <section class="card">
          <h2 class="section-title">Código de recuperação</h2>
          <p class="hint" style={{ marginTop: 0 }}>
            Gerar um código novo <strong>invalida o anterior</strong> na hora. Faça isso se o código
            antigo tiver sido visto por alguém, digitado fora da Arca ou enviado por mensagem.
          </p>

          <div class="field">
            <label for="rec">Confirme sua senha</label>
            <input id="rec" type="password" value={recoveryPassword} autocomplete="current-password"
              onInput={(e) => setRecoveryPassword((e.target as HTMLInputElement).value)} />
          </div>

          <button disabled={busy || !recoveryPassword} onClick={doRegenerate}>
            Gerar novo código
          </button>

          {newCode && (
            <>
              <div class="code">{newCode}</div>
              <p class="hint">
                Anote no papel e guarde longe do computador. O código antigo já não vale mais.
              </p>
            </>
          )}
        </section>
      </div>

      {message && <p class="notice ok">{message}</p>}
      {error && <p class="notice bad">{error}</p>}
    </>
  );
}
