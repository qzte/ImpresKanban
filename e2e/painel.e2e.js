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
        let licenca = 'granted';
        window.__PASTA = { ficheiros, escritas: 0, pedidos: 0, licenca(v) { licenca = v; } };
        const handle = {
            kind: 'directory', name: 'partilhada',
            async queryPermission() { return licenca; },
            async requestPermission() { window.__PASTA.pedidos++; licenca = 'granted'; return 'granted'; },
            async getFileHandle(nome) {
                if (licenca !== 'granted') throw new DOMException('Sem licença', 'NotAllowedError');
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

    // v4.33.0: o ficheiro diz quem o gravou (autor), para o painel mostrar a quem perguntar.
    test('ao escolher a pasta pergunta o nome deste computador e grava-o; «Mudar nome» muda-o', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: { ...REFERENCIAS, kanban_registos: [] } });
        try {
            await pastaFalsa(page);
            page.once('dialog', d => d.accept('PC Farmácia'));
            await page.evaluate(() => document.getElementById('btnPainel').click());
            await page.waitForFunction(() => !!window.__PASTA.ficheiros['impreskanban.painel.json']);
            assert.equal((await lerFeed(page)).autor, 'PC Farmácia');
            assert.match(await page.locator('#painelAutor').textContent(), /PC Farmácia/);
            page.once('dialog', d => d.accept('Ana'));
            await page.evaluate(() => document.getElementById('btnPainelAutor').click());   // o cartão está noutro separador
            await page.waitForFunction(() => (window.__PASTA.ficheiros['impreskanban.painel.json'] || '').includes('"autor":"Ana"'), null, { timeout: 10000 });
            assert.match(await page.locator('#painelAutor').textContent(), /Ana/);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('sem licença, a faixa avisa e um clique em qualquer sítio dá acesso e grava; sem pasta, não há faixa', async () => {
        const { context, page } = await abrirApp(browser, url, { storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1, { data: '2026-09-23', qtdKanbans: 3, tipoErro: 'KB Perdido' })] } });
        try {
            await pastaFalsa(page);
            assert.equal(await page.locator('#painelAviso').isVisible(), false, 'sem pasta não há aviso');
            await page.evaluate(() => document.getElementById('btnPainel').click());
            await page.waitForFunction(() => !!window.__PASTA.ficheiros['impreskanban.painel.json']);
            assert.equal(await page.locator('#painelAviso').isVisible(), false, 'com licença não há aviso');
            await page.evaluate(() => window.__PASTA.licenca('prompt'));
            await page.evaluate(async () => {
                registos.push({ uuid: 'novo-2', data: '2026-09-23', qtdKanbans: 4, tipoErro: 'KB Danificado', servico: 'UCIP' });
                await salvarDados();
            });
            await page.locator('#painelAviso').waitFor({ state: 'visible', timeout: 10000 });
            assert.match(await page.locator('#painelAvisoTxt').textContent(), /Sem acesso de gravação à pasta «partilhada»/);
            assert.equal((await lerFeed(page)).dados.hoje, 3, 'ainda não gravou');
            await page.locator('header h1').click();       // um clique em qualquer sítio
            await page.waitForFunction(() => JSON.parse(window.__PASTA.ficheiros['impreskanban.painel.json']).dados.hoje === 7, null, { timeout: 10000 });
            await page.locator('#painelAviso').waitFor({ state: 'hidden', timeout: 5000 });
            assert.equal(await page.evaluate(() => window.__PASTA.pedidos), 1);
        } finally {
            await context.close();
        }
    });
});
