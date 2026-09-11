// Fonte única da versão da app — NÃO duplicar este valor noutro sítio.
// index.html carrega este ficheiro via <script src="version.js"> (define
// APP_VERSION antes do script inline que o usa); sw.js via
// importScripts('./version.js'). O CI (scripts/check-version-sync.js)
// falha se o cabeçalho CSS ou a última entrada do changelog em
// index.html divergirem deste valor.
const APP_VERSION = '4.15.2';
