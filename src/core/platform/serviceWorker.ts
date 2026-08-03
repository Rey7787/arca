/**
 * Registro do service worker.
 *
 * A atualização NUNCA é aplicada sozinha: recarregar a página no meio de um
 * lançamento sendo digitado perderia o que a pessoa escreveu e ainda trancaria
 * a Arca. O app pergunta antes.
 */
export function registerServiceWorker(onUpdateReady: () => void): void {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return; // em desenvolvimento atrapalha o hot reload

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const waiting = registration.installing;
          if (!waiting) return;
          waiting.addEventListener('statechange', () => {
            if (waiting.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateReady();
            }
          });
        });
      })
      .catch(() => undefined);
  });
}

export async function applyUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.waiting?.postMessage('aplicar-atualizacao');
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
    once: true,
  });
}
