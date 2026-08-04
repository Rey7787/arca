import { useEffect, useState } from 'preact/hooks';
import { createProfile, listProfiles, unlock } from '@/modules/auth/service';
import { checkPassword, roughEntropyBits } from '@/shared/password';
import type { VaultMeta } from '@/core/storage/db';
import { ArcaMark } from './ArcaMark';

type Props = { onUnlocked: (profileId: string) => void };

export function UnlockScreen({ onUnlocked }: Props) {
  const [profiles, setProfiles] = useState<VaultMeta[] | null>(null);
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  useEffect(() => {
    void listProfiles().then(setProfiles);
  }, []);

  if (profiles === null) return <div class="shell" />;

  const isFirstUse = profiles.length === 0;
  const check = checkPassword(password);
  const bits = roughEntropyBits(password);

  async function handleSubmit() {
    setBusy(true);
    setError('');
    try {
      if (isFirstUse) {
        const created = await createProfile('Principal', password);
        setRecoveryCode(created.recoveryCode);
        sessionStorage.setItem('arca:pending-profile', created.profileId);
      } else {
        const profile = profiles![0]!;
        const ok = await unlock(profile.id, password);
        if (!ok) setError('Senha incorreta.');
        else onUnlocked(profile.id);
      }
    } finally {
      setBusy(false);
      setPassword('');
    }
  }

  if (recoveryCode) {
    return (
      <div class="shell">
        <div class="panel">
          <div class="seam" data-open="true" />
          <header class="panel-brand">
            <ArcaMark size={44} />
            <h1 class="wordmark">Arca</h1>
          </header>
          <p class="subtitle">Anote este código antes de continuar</p>
          <p class="hint">
            Ele abre a Arca se você esquecer a senha. Não existe outro caminho — sem servidor,
            não há como recuperar seus dados sem ele.
          </p>
          <div class="code">{recoveryCode}</div>
          <button
            class="primary"
            onClick={() => {
              const id = sessionStorage.getItem('arca:pending-profile')!;
              sessionStorage.removeItem('arca:pending-profile');
              onUnlocked(id);
            }}
          >
            Anotei o código
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="shell">
      <div class="panel">
        <div class="seam" data-open="false" />
        <header class="panel-brand">
          <ArcaMark size={44} />
          <h1 class="wordmark">Arca</h1>
        </header>
        <p class="subtitle">Gerenciador financeiro pessoal</p>

        <div class="field">
          <label for="pwd">{isFirstUse ? 'Crie sua senha' : 'Senha'}</label>
          <div class="field-row">
            <input
              id="pwd"
              type={reveal ? 'text' : 'password'}
              value={password}
              autocomplete={isFirstUse ? 'new-password' : 'current-password'}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (!isFirstUse || check.valid)) void handleSubmit();
              }}
            />
            <button
              class="reveal"
              type="button"
              aria-label={reveal ? 'Ocultar senha' : 'Mostrar senha'}
              onClick={() => setReveal(!reveal)}
            >
              {reveal ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {isFirstUse && password && (
            <>
              <div class="meter">
                <i style={{ width: `${Math.min(100, (bits / 100) * 100)}%` }} />
              </div>
              <p class={check.valid ? 'hint' : 'problem'}>
                {check.valid ? 'Sem limite de tamanho — uma frase longa é ainda mais forte.' : check.problems[0]}
              </p>
            </>
          )}

          {error && <p class="problem">{error}</p>}
        </div>

        <button class="primary" disabled={busy || (isFirstUse && !check.valid)} onClick={handleSubmit}>
          {busy ? 'Abrindo…' : isFirstUse ? 'Criar Arca' : 'Abrir'}
        </button>

        <p class="hint lock-note">
          <span class="lock-dot" aria-hidden="true" />
          Cifrado neste dispositivo. Nada é enviado para servidor nenhum.
        </p>
      </div>
    </div>
  );
}
