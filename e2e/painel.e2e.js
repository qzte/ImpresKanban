// Painel e-ink (v4.24.0): a app grava impreskanban.painel.json numa pasta partilhada, que o
// painel.html (qzte/e-ink_panel) lê. O browser de teste não tem pasta: uma de mentira, em
// memória, no lugar do showDirectoryPicker (posta depois do arranque — o escritor só a
// pede ao clicar em «Escolher pasta»).

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

async function pastaFalsa(page) {
    await page.evaluate(() => {
        const ficheiros = {};
        window.__PASTA = { ficheiros, escritas: 0 };
        const handle = {
            kind: 'directory', name: 'partilhada',
            async queryPermission() { return 'granted'; },
            async requestPermission() { return 'granted'; },
            async getFileHandle(nome) {
                return { async createWritable() {
                    let t = '';
                    return { async write(x) { t += x; }, async close() { ficheiros[nome] = t; window.__PASTA.escritas++; }, async abort() {} };
                } };
            },
        };
        window.showDirectoryPicker = async () => handle;
    });
}
const lerFeed = page => page.evaluate(() => {
    const t = window.__PASTA.ficheiros['impreskanban.painel.json'];
    return t ? JSON.parse(t) : null;
});

describe('Painel e-ink (impreskanban.painel.json)', () => {
    test('escolher a pasta grava o resumo no formato do painel; um registo novo volta a gravá-lo', async () => {
        const hoje = '2026-09-23';   // DATA_PADRAO dos helpers
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [
                criarRegisto(1, { data: hoje, qtdKanbans: 3, tipoErro: 'KB Perdido' }),
                criarRegisto(2, { data: '2026-09-20', qtdKanbans: 2, tipoErro: 'KB Perdido' }),
            ] },
        });
        try {
            await pastaFalsa(page);
            assert.match(await page.locator('#painelEstado').textContent(), /Nenhuma pasta/);
            await page.evaluate(() => document.getElementById('btnPainel').click());
            await page.waitForFunction(() => !!window.__PASTA.ficheiros['impreskanban.painel.json']);
            const f = await lerFeed(page);
            assert.equal(f.formato, 'painel-feed');
            assert.equal(f.versao, 1);
            assert.equal(f.app, 'impreskanban');
            assert.equal(f.dados.hoje, 3);
            assert.equal(f.dados.semana, 5);
            assert.equal(f.dados.ultimo, hoje);
            assert.match(await page.locator('#painelEstado').textContent(), /partilhada/);

            // Um registo novo: salvarDados() agenda a escrita (~2 s depois).
            await page.evaluate(async (d) => {
                registos.push({ uuid: 'novo-1', data: d, qtdKanbans: 4, tipoErro: 'KB Danificado', servico: 'UCIP' });
                await salvarDados();
            }, hoje);
            await page.waitForFunction(() => {
                const t = window.__PASTA.ficheiros['impreskanban.painel.json'];
                return t && JSON.parse(t).dados.hoje === 7;
            }, null, { timeout: 10000 });
            const g = await lerFeed(page);
            assert.deepEqual(g.dados.erros.map(e => e.tipo), ['KB Perdido', 'KB Danificado']);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});
