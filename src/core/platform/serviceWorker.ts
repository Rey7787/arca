/**
 * Registro do service worker.
 *
 * A atualização NUNCA é aplicada sozinha: recarregar a página no meio de um
 * lançamento sendo digitado perderia o que a pessoa escreveu e ainda trancaria
 * a Arca. O app pergunta antes.
 */

/** De quanto em quanto tempo perguntar ao servidor se há versão nova. */
const INTERVALO_CHECAGEM_MS = 60 * 60 * 1000; // 1 hora

export function registerServiceWorker(onUpdateReady: () => void): void {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return; // em desenvolvimento atrapalha o hot reload

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        // Caso 1: o worker novo JÁ terminou de instalar antes desta página
        // carregar (deploy entre duas visitas). Nesse caso 'updatefound' não
        // dispara mais e o aviso nunca apareceria — o app ficaria rodando a
        // versão velha para sempre, já que o cache é cache-first.
        if (registration.waiting && navigator.serviceWorker.controller) {
          onUpdateReady();
        }

        // Caso 2: o worker novo chega com a página já aberta.
        registration.addEventListener('updatefound', () => {
          const novo = registration.installing;
          if (!novo) return;
          novo.addEventListener('statechange', () => {
            if (novo.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateReady();
            }
          });
        });

        // O navegador só checa atualização em navegação. Um PWA instalado pode
        // ficar dias sem isso, então perguntamos de tempos em tempos e sempre
        // que o app volta para o primeiro plano.
        const checar = () => void registration.update().catch(() => undefined);
        setInterval(checar, INTERVALO_CHECAGEM_MS);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checar();
        });
      })
      .catch(() => undefined);
  });
}

export async function applyUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const esperando = registration?.waiting;

  // Sem worker em espera não há troca de controlador — 'controllerchange' nunca
  // dispararia e o botão de atualizar ficaria mudo. Recarrega direto.
  if (!esperando) {
    location.reload();
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
    once: true,
  });

  esperando.postMessage({ type: 'aplicar-atualizacao' });

  // Rede de segurança: se por algum motivo a troca não acontecer, recarrega
  // assim mesmo em vez de deixar a pessoa clicando num botão que não responde.
  setTimeout(() => location.reload(), 5000);
}
