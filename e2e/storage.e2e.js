// Motor de armazenamento: IndexedDB (v4.23.0). Cobre o que os outros
// ficheiros e2e/*.e2e.js não testam diretamente: que os dados realmente vão
// para o IndexedDB (não localStorage), que uma instalação ≤ v4.22.0 migra
// sem perder dados, e que a app continua a funcionar (via fallback) se o
// IndexedDB estiver indisponível. Os outros ficheiros já cobrem, através de
// storageGet()/lerStorageJSON(), que o comportamento da app não mudou.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor, abrirApp, criarRegisto, REFERENCIAS, chromium } = require('./helpers');

let browser, servidor, url;
before(async () => {
    ({ servidor, url } = await iniciarServidor());
    browser = await chromium.launch();
});
after(async () => {
    await browser?.close();
    servidor?.close();
});

describe('Motor de armazenamento (IndexedDB)', () => {
    test('os dados gravados vão para o IndexedDB, não para o localStorage', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1)] },
        });
        try {
            const r = await page.evaluate(async () => ({
                localStorageVazio: localStorage.getItem('kanban_registos'),
                indexedDBTemDados: (await storageGet('kanban_registos')) !== null,
            }));
            assert.equal(r.localStorageVazio, null, 'localStorage não guarda mais os registos diretamente');
            assert.ok(r.indexedDBTemDados, 'os registos estão no IndexedDB');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('uma instalação ≤ v4.22.0 (dados só em localStorage) migra para IndexedDB sem perder nada', async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const erros = [];
        page.on('pageerror', e => erros.push('pageerror: ' + e.message));
        page.on('console', m => { if (m.type() === 'error') erros.push('console.error: ' + m.text()); });
        try {
            await page.addInitScript((regs) => {
                localStorage.setItem('kanban_registos', JSON.stringify(regs));
                localStorage.setItem('kanban_ref_artigo', JSON.stringify([
                    { CODIGO: '0000012345', DESCRICAO_CODIGO: 'Luvas Nitrilo M', ARMAZEM: 'A1' },
                ]));
            }, [{ uuid: 'old-1', data: '2026-01-01', servicoId: '101', artigo: '0000012345', qtdKanbans: 1 }]);
            await page.goto(url);
            await page.waitForFunction(() => window.__appPronta === true);

            const r = await page.evaluate(() => ({
                registosCarregados: registos.length,
                localStorageLimpo: localStorage.getItem('kanban_registos'),
                marcadorMigracao: localStorage.getItem('kanban_migrado_idb_v1'),
            }));
            assert.equal(r.registosCarregados, 1, 'o registo antigo foi carregado corretamente');
            assert.equal(r.localStorageLimpo, null, 'localStorage foi limpo depois de migrar');
            assert.equal(r.marcadorMigracao, '1', 'migração marcada como concluída');
            assert.deepEqual(erros, []);

            // Segundo arranque: a migração não repete nem duplica dados
            await page.reload();
            await page.waitForFunction(() => window.__appPronta === true);
            assert.equal(await page.evaluate(() => registos.length), 1);
        } finally {
            await context.close();
        }
    });

    test('sem IndexedDB disponível, cai para localStorage e continua a funcionar', async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const erros = [];
        page.on('pageerror', e => erros.push('pageerror: ' + e.message));
        try {
            await page.addInitScript(() => {
                Object.defineProperty(window, 'indexedDB', { value: undefined });
            });
            await page.goto(url);
            await page.waitForFunction(() => window.__appPronta === true);

            const r = await page.evaluate(async () => {
                const gravado = await storageSet('teste_fallback', 'valor123');
                const lido = await storageGet('teste_fallback');
                return { ok: gravado.ok, lido, emLocalStorage: localStorage.getItem('teste_fallback') };
            });
            assert.equal(r.ok, true, 'a gravação não falha, mesmo sem IndexedDB');
            assert.equal(r.lido, 'valor123');
            assert.equal(r.emLocalStorage, 'valor123', 'cai para localStorage como motor de reserva');
            assert.deepEqual(erros, [], 'sem IndexedDB não deve gerar nenhuma exceção não apanhada');
        } finally {
            await context.close();
        }
    });

    test('guarda registos com mais de 5MB — acima do limite típico do localStorage', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFERENCIAS });
        try {
            const r = await page.evaluate(async () => {
                // ~8MB de dados — dentro do que o localStorage tipicamente rejeita
                const grandes = Array.from({ length: 25000 }, (_, i) => ({
                    uuid: 'u' + i, data: '2026-01-01', obs: 'x'.repeat(200),
                }));
                const resultado = await storageSetJSON('__teste_grande__', grandes);
                const lido = await storageGetJSON('__teste_grande__');
                await storageRemove('__teste_grande__');
                return { ok: resultado.ok, tamanho: lido?.length };
            });
            assert.equal(r.ok, true, 'grava sem quota esgotada');
            assert.equal(r.tamanho, 25000, 'lê de volta o conteúdo completo');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});
