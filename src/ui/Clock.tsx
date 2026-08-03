import { useEffect, useState } from 'preact/hooks';
import { vault } from '@/core/crypto/vault';

/**
 * Relógio + contagem até o bloqueio automático.
 *
 * A hora responde "posso continuar mais um pouco?"; o contador responde
 * "quanto tempo tenho antes de ter que digitar a senha de novo?". A segunda
 * pergunta é a que realmente incomoda quem está no meio de um lançamento.
 */
export function Clock() {
  const [now, setNow] = useState(() => new Date());
  const [remaining, setRemaining] = useState(() => vault.remainingMs());

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
      setRemaining(vault.remainingMs());
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const urgent = remaining > 0 && remaining <= 60_000;

  return (
    <div class="clock" title={`Bloqueio automático após ${vault.idleLimitMinutes} min sem uso`}>
      <strong>
        {now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}
      </strong>
      <small class={urgent ? 'urgent' : ''}>
        {remaining > 0
          ? `bloqueia em ${minutes}:${String(seconds).padStart(2, '0')}`
          : 'bloqueando…'}
      </small>
    </div>
  );
}
