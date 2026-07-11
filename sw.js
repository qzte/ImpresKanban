/* =====================================================
   SERVICE WORKER — Kanban KPI Analyzer
   Versão: 4.10.0
   ------------------------------------------------
   Estratégia:
   - App shell (HTML, manifest, ícones): cache-first,
     com atualização em segundo plano (stale-while-revalidate)
   - Bibliotecas CDN (xlsx.js, jsPDF, autotable, Google Fonts):
     cache-first — depois da 1ª visita online ficam
     disponíveis offline (necessárias para exportar
     Excel/PDF sem ligação à internet)
   - CACHE_NAME está ligado à versão da app: cada bump de
     versão invalida automaticamente o cache antigo
   ===================================================== */

const APP_VERSION = '4.10.0';
const CACHE_NAME = `kanban-kpi-v${APP_VERSION}`;

const APP_SHELL = [
    './kanban-kpi-analyzer-v4_10_0.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];

// ==========================================
// INSTALL — pré-cache do app shell + libs CDN
// ==========================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // App shell: se falhar, a instalação do SW falha (é essencial)
            const shellPromise = cache.addAll(APP_SHELL);

            // CDN: melhor esforço — não bloquear a instalação se uma
            // biblioteca externa estiver indisponível no momento
            const cdnPromise = Promise.allSettled(
                CDN_ASSETS.map((url) =>
                    fetch(url, { mode: 'no-cors' })
                        .then((resp) => cache.put(url, resp))
                        .catch((err) => console.warn('[SW] Falha ao pré-cachear:', url, err))
                )
            );

            return Promise.all([shellPromise, cdnPromise]);
        }).then(() => self.skipWaiting())
    );
});

// ==========================================
// ACTIVATE — limpar caches de versões antigas
// ==========================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((nomes) =>
            Promise.all(
                nomes
                    .filter((nome) => nome !== CACHE_NAME)
                    .map((nome) => caches.delete(nome))
            )
        ).then(() => self.clients.claim())
    );
});

// ==========================================
// FETCH — cache-first com atualização em segundo plano
// ==========================================
self.addEventListener('fetch', (event) => {
    // Apenas GET é cacheável
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const networkFetch = fetch(event.request)
                .then((networkResponse) => {
                    // Só guarda respostas válidas (ou opacas, no caso de recursos cross-origin no-cors)
                    if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse); // Offline e sem cache prévio: falha silenciosa

            // Cache-first: responde imediatamente se existir, atualiza em fundo
            return cachedResponse || networkFetch;
        })
    );
});
