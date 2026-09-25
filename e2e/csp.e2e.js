// Content-Security-Policy (v4.20.0): confirma que a política declarada em
// <meta> não bloqueia nada que a app precise de facto — em especial os 3
// scripts de CDN (xlsx.js, jsPDF, autotable), a única coisa que script-src
// permite fora de 'self'. Corre com bytes idênticos aos da CDN (ver
// e2e/fixtures/README.md), por isso testa o comportamento real das
// bibliotecas sob esta política, não uma cópia simplificada.
//
// Os outros ficheiros e2e/*.e2e.js já cobrem, sem o saberem, que o CSP não
// bloqueia os ~90 onclick="" e ~480 style="" inline nem os downloads via
// <a download>: usam abrirApp() normal (sem servirFixturesCDN) e todos
// fazem assert.deepEqual(erros, []), e erros inclui agora violações de CSP
// (ver helpers.js). Este ficheiro cobre só o que só existe com a CDN.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { iniciarServidor, abrirApp, REFERENCIAS, FIXTURES_DIR, extrairURLsCDNLibs, chromium } = require('./helpers');

let browser, servidor, url;
before(async () => {
    ({ servidor, url } = await iniciarServidor());
    browser = await chromium.launch();
});
after(async () => {
    await browser?.close();
    servidor?.close();
});

describe('Content-Security-Policy', () => {
    test('a política está declarada e cobre os 3 domínios de CDN usados', async () => {
        const { context, page, erros } = await abrirApp(browser, url);
        try {
            const conteudo = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
            assert.ok(conteudo, 'meta CSP presente');
            for (const diretiva of ["default-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'self'"]) {
                assert.ok(conteudo.includes(diretiva), `falta "${diretiva}"`);
            }
            // As 3 URLs de CDN_LIBS têm de estar cobertas por script-src
            const scriptSrc = /script-src([^;]*)/.exec(conteudo)[1];
            for (const urlCDN of extrairURLsCDNLibs()) {
                const origem = new URL(urlCDN).origin;
                assert.ok(scriptSrc.includes(origem), `script-src não cobre ${origem}`);
            }
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('Importar Referências: xlsx.js lê o ficheiro real sob CSP, sem violações', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { servirFixturesCDN: true });
        try {
            await page.setInputFiles('#fileReferencia', path.join(FIXTURES_DIR, 'referencias-exemplo.xlsx'));
            await page.waitForFunction(() => typeof XLSX !== 'undefined' && tArtigo.length === 2);

            const estado = await page.evaluate(() => ({
                artigo: tArtigo[0].DESCRICAO_CODIGO,
                servico: tServicos[0].Servico,
                utilizador: tUtilizadores[0].Nome,
                erro: tErros[1].Descricao,
            }));
            assert.equal(estado.artigo, 'Luvas Nitrilo M');
            assert.equal(estado.servico, 'Urgência');
            assert.equal(estado.utilizador, 'Ana Silva');
            assert.equal(estado.erro, 'Kanban danificado');
            assert.deepEqual(erros, [], 'sem violações de CSP nem erros ao ler o Excel real');
        } finally {
            await context.close();
        }
    });

    test('Exportar Dados: XLSX.write gera o ficheiro sob CSP, sem violações', async () => {
        const { criarRegisto } = require('./helpers');
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1)] },
            servirFixturesCDN: true,
        });
        try {
            await page.click('#mainTabGestao');
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.click('#btnExportar'),
            ]);
            assert.match(download.suggestedFilename(), /\.xlsx$/);
            const bytes = require('fs').statSync(await download.path()).size;
            assert.ok(bytes > 1000, 'ficheiro .xlsx gerado tem conteúdo real, não está vazio');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('Relatório PDF mensal: jsPDF + autotable geram o ficheiro sob CSP, sem violações', async () => {
        const { criarRegisto } = require('./helpers');
        const registos = Array.from({ length: 5 }, (_, i) => criarRegisto(i, { data: '2026-09-1' + i }));
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: registos },
            servirFixturesCDN: true,
        });
        try {
            await page.click('#mainTabRelatorios');
            await page.click('button[onclick="selecionarPeriodoMensal(\'atual\')"]');
            await page.waitForFunction(() => !document.getElementById('btnGerarMensal').disabled);

            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.click('#btnGerarMensal'),
            ]);
            assert.match(download.suggestedFilename(), /\.pdf$/);
            const bytes = require('fs').statSync(await download.path()).size;
            assert.ok(bytes > 1000, 'PDF gerado tem conteúdo real, não está vazio');
            assert.deepEqual(erros, [], 'jsPDF/autotable não violam o CSP (ex.: eval interno)');
        } finally {
            await context.close();
        }
    });
});
