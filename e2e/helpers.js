// Infraestrutura dos testes de interface (Playwright + node:test).
//
// - Servidor estático mínimo (sem dependências) sobre a raiz do repositório
// - Página com relógio fixo, fuso/idioma de Portugal, Service Worker
//   bloqueado e pedidos externos (CDN/Google Fonts) cortados: os testes não
//   dependem de rede e o resultado não muda com o dia em que o CI corre
// - Erros de página, console.error e violações de CSP (evento
//   securitypolicyviolation) são recolhidos no mesmo array `erros` — os
//   testes existentes que já fazem assert.deepEqual(erros, []) passam a
//   verificar de borla que o Content-Security-Policy (v4.20.0) não bloqueia
//   nada nesses fluxos, sem precisar de o saber

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
};

// URLs da CDN (window.CDN_LIBS em index.html) → ficheiro local em
// e2e/fixtures/cdn-libs/. São bytes idênticos ao que está na CDN — só o pedido
// de rede é local, o resto do teste (SRI, parsing, CSP) corre sobre o
// ficheiro real (ver e2e/fixtures/README.md para a proveniência e o hash).
function extrairURLsCDNLibs() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const bloco = /window\.CDN_LIBS\s*=\s*\{([\s\S]*?)\n {8}\};/.exec(html);
    if (!bloco) throw new Error('window.CDN_LIBS não encontrado em index.html');
    return [...bloco[1].matchAll(/src:\s*'([^']+)'/g)].map(m => m[1]);
}

function mapaFixturesCDN() {
    const mapa = {};
    for (const url of extrairURLsCDNLibs()) {
        mapa[url] = path.join(__dirname, 'fixtures', 'cdn-libs', path.basename(url));
    }
    return mapa;
}

// Quarta-feira: não é o dia do backup semanal (BACKUP_DIA_SEMANA = sexta),
// por isso o modal obrigatório não tapa a página nos testes que não o testam
const DATA_PADRAO = new Date('2026-09-23T10:00:00+01:00');

function iniciarServidor() {
    const servidor = http.createServer((req, res) => {
        const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const ficheiro = path.join(ROOT, caminho === '/' ? 'index.html' : caminho);
        if (!ficheiro.startsWith(ROOT) || !fs.existsSync(ficheiro) || fs.statSync(ficheiro).isDirectory()) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(ficheiro)] || 'application/octet-stream' });
        fs.createReadStream(ficheiro).pipe(res);
    });
    return new Promise(resolve => {
        servidor.listen(0, '127.0.0.1', () => {
            resolve({ servidor, url: `http://127.0.0.1:${servidor.address().port}/index.html` });
        });
    });
}

// Referências mínimas, no formato em que carregarReferencias() as guarda
const REFERENCIAS = {
    kanban_ref_artigo: [
        { CODIGO: '0000012345', DESCRICAO_CODIGO: 'Luvas Nitrilo M', ARMAZEM: 'A1' },
        { CODIGO: '0000067890', DESCRICAO_CODIGO: 'Seringa 5ml', ARMAZEM: 'B2' },
    ],
    kanban_ref_servicos: [
        { ID_Servico: '101', Servico: 'Urgência', Local: 'Piso 0' },
        { ID_Servico: '202', Servico: 'Pediatria', Local: 'Piso 2' },
    ],
    kanban_ref_utilizadores: [{ UUID: 'user-1', Nome: 'Ana Silva' }],
    kanban_ref_erros: [
        { Codigo: '1', Descricao: 'Sem erro' },
        { Codigo: '5', Descricao: 'Kanban danificado' },
    ],
};

function criarRegisto(i, extra = {}) {
    return {
        uuid: `seed-${i}`,
        id: 1000 + i,
        data: `2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}`,
        utilizadorUUID: 'user-1',
        utilizadorNome: 'Ana Silva',
        servicoId: '101',
        servico: 'Urgência',
        artigo: '0000012345',
        artigoDescricao: 'Luvas Nitrilo M',
        armazem: 'A1',
        origem: 'Armazém',
        qtdKanbans: 1,
        tipoErro: '1',
        timestamp: '2026-09-01T10:00:00.000Z',
        dataModificacao: '2026-09-01T10:00:00.000Z',
        ...extra,
    };
}

/**
 * Abre a app num contexto novo.
 * @param {string} url
 * @param {Object} [opcoes]
 * @param {Object} [opcoes.storage] - chaves de localStorage a semear antes do arranque
 *   (valores não-string são serializados em JSON). Só na 1ª navegação: um
 *   reload mantém o que a app gravou.
 * @param {Date} [opcoes.agora] - data/hora fixa do relógio da página
 * @param {boolean} [opcoes.aceitarDialogos] - aceitar confirm() abertos durante
 *   o próprio arranque (sem handler, o Playwright cancela-os)
 * @param {boolean} [opcoes.servirFixturesCDN] - responder aos 3 pedidos para
 *   cdnjs.cloudflare.com (xlsx.js, jsPDF, autotable) com os ficheiros locais
 *   em e2e/fixtures/cdn-libs/, em vez de os cortar como o resto da rede
 *   externa. Necessário para testar Importar/Exportar Excel e Relatórios PDF
 *   sem depender da CDN estar acessível (ver e2e/csp.e2e.js)
 */
async function abrirApp(browser, url, {
    storage = {}, agora = DATA_PADRAO, aceitarDialogos = false, servirFixturesCDN = false,
} = {}) {
    const context = await browser.newContext({
        serviceWorkers: 'block',
        acceptDownloads: true,
        locale: 'pt-PT',
        timezoneId: 'Europe/Lisbon',
    });

    // Playwright corre os handlers de route pela ordem INVERSA de registo (o
    // último registado tem prioridade) — por isso o bloqueio geral de rede
    // externa é registado primeiro, e as fixtures da CDN (quando pedidas)
    // depois, para ficarem por cima desse bloqueio só para essas 3 URLs
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    if (servirFixturesCDN) {
        for (const [urlCDN, ficheiro] of Object.entries(mapaFixturesCDN())) {
            await context.route(urlCDN, route => route.fulfill({
                status: 200,
                contentType: 'text/javascript; charset=utf-8',
                body: fs.readFileSync(ficheiro),
            }));
        }
    }

    const page = await context.newPage();
    await page.clock.setFixedTime(agora);

    if (aceitarDialogos) page.on('dialog', d => d.accept());

    const erros = [];
    const logs = [];
    page.on('pageerror', e => erros.push(`pageerror: ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error') erros.push(`console.error: ${m.text()}`);
        if (m.type() === 'log') logs.push(m.text());
    });
    // O CSP (v4.20.0) é aplicado via <meta>, por isso violações não abortam
    // nada sozinhas — chegam como este evento DOM (e como console.error,
    // já capturado acima, mas o evento dá directive/blockedURI estruturados)
    await page.exposeFunction('__e2eRegistarViolacaoCSP', v => {
        erros.push(`CSP violation: ${v.violatedDirective} bloqueou ${v.blockedURI}`);
    });
    await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', e => {
            window.__e2eRegistarViolacaoCSP({ violatedDirective: e.violatedDirective, blockedURI: e.blockedURI });
        });
    });

    const entradas = Object.entries(storage).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);
    await page.addInitScript(entradas => {
        // Headless: forçar o caminho de download clássico (<a download>) em
        // vez do diálogo "Guardar como" da File System Access API — a app
        // testa com `'showSaveFilePicker' in window`, por isso tem de sair
        // também do protótipo
        delete Window.prototype.showSaveFilePicker;
        delete window.showSaveFilePicker;

        if (sessionStorage.getItem('__e2e_semeado')) return;
        sessionStorage.setItem('__e2e_semeado', '1');
        localStorage.clear();
        for (const [k, v] of entradas) localStorage.setItem(k, v);
    }, entradas);

    await page.goto(url);
    // A app termina a inicialização em DOMContentLoaded + alguns setTimeout
    await page.waitForFunction(() => typeof registos !== 'undefined' && document.readyState === 'complete');
    return { context, page, erros, logs };
}

async function lerStorageJSON(page, chave) {
    return page.evaluate(k => JSON.parse(localStorage.getItem(k)), chave);
}

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

module.exports = {
    iniciarServidor, abrirApp, lerStorageJSON, criarRegisto, REFERENCIAS, DATA_PADRAO, chromium,
    FIXTURES_DIR, extrairURLsCDNLibs,
};
