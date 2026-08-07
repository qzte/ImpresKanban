/* =====================================================
   SERVICE WORKER — Kanban KPI Analyzer
   Versão: 4.11.4
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
   - Navegação offline: qualquer pedido de navegação sem
     correspondência em cache responde com o app shell
   - Só é cacheado same-origin + CDNs conhecidas: evita
     crescimento ilimitado do cache com recursos externos
   ===================================================== */

const APP_VERSION = '4.11.4';
const CACHE_NAME = `kanban-kpi-v${APP_VERSION}`;

// Documento estável servido à PWA. NÃO usar o nome versionado:
// um bump de versão partiria as instalações já existentes.
const APP_SHELL_DOC = './index.html';

const APP_SHELL = [
    APP_SHELL_DOC,
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];

// Origens externas cujas respostas podem ser guardadas em cache
const CDN_HOSTS = [
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

/**
 * Um pedido só é cacheável se for same-origin ou vier de uma CDN conhecida.
 * Sem esta restrição, qualquer recurso externo alcançado pela app acabaria
 * no cache, que cresceria sem limite.
 */
function podeSerCacheado(url) {
    return url.origin === self.location.origin || CDN_HOSTS.includes(url.hostname);
}

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
                    // 'cors' (não 'no-cors'): respostas opacas são incompatíveis
                    // com a verificação SRI dos scripts CDN (v4.11.1)
                    fetch(url, { mode: 'cors' })
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

    const url = new URL(event.request.url);
    if (!podeSerCacheado(url)) return; // deixa passar para a rede, sem tocar no cache

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
                .catch(() => {
                    // Offline: navegação sem cache próprio cai no app shell
                    if (event.request.mode === 'navigate') {
                        return caches.match(APP_SHELL_DOC);
                    }
                    return cachedResponse; // undefined se nunca foi cacheado
                });

            // Cache-first: responde imediatamente se existir, atualiza em fundo
            return cachedResponse || networkFetch;
        })
    );
});
