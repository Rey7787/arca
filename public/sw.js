/*
 * Service worker da Arca — escrito à mão, sem biblioteca.
 *
 * Estratégia: cache-first com preenchimento em tempo de execução.
 * Não depende de lista de arquivos gerada no build (que quebra silenciosamente
 * quando o nome com hash muda) — o que foi baixado uma vez fica guardado.
 *
 * Regra que não pode ser quebrada: este worker NUNCA toca em dado do usuário.
 * Os lançamentos vivem no IndexedDB, cifrados, e nada aqui os lê ou envia.
 * O cache guarda só o app em si: HTML, CSS, JavaScript e ícones.
 */
const VERSION = 'arca-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Só GET de mesma origem. Nada de interceptar envio de dado.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navegação: tenta a rede para pegar versão nova; sem rede, serve o cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((r) => r ?? Response.error())),
    );
    return;
  }

  // Demais recursos: cache primeiro — abre instantâneo e funciona offline.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

// O app avisa quando o usuário aceitar a atualização.
self.addEventListener('message', (event) => {
  if (event.data === 'aplicar-atualizacao') self.skipWaiting();
});
