// Backup automático na pasta partilhada (v4.32.0): com a pasta escolhida, cada alteração é gravada
// em impreskanban_backup.json; se outra pessoa gravou entretanto, a gravação automática pára e a
// versão da pasta abre-se pela importação normal. A pasta é de mentira, em memória.

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

const FICHEIRO = 'impreskanban_backup.json';

// `inicial`: ficheiros que a pasta já tem (nome → texto).
async function pastaFalsa(page, inicial = {}) {
    await page.evaluate(ini => {
        const raiz = { ...ini }, copias = {};
        window.__PASTA = { raiz, copias, escritas: 0 };
        const escritor = (alvo, nome) => ({
            async write(x) { this.t = (this.t || '') + x; },
            async close() { alvo[nome] = this.t || ''; window.__PASTA.escritas++; },
            async abort() {},
        });
        const naoExiste = () => Object.assign(new Error('nao existe'), { name: 'NotFoundError' });
        const dirCopias = {
            async getFileHandle(nome, op) { return { async createWritable() { return escritor(copias, nome); } }; },
            async removeEntry(nome) { delete copias[nome]; },
            keys: async function* () { for (const k of Object.keys(copias)) yield k; },
        };
        const handle = {
            kind: 'directory', name: 'partilhada',
            async queryPermission() { return 'granted'; },
            async requestPermission() { return 'granted'; },
            async getFileHandle(nome, op) {
                if (!(nome in raiz) && !(op && op.create)) throw naoExiste();
                return {
                    async getFile() { const t = raiz[nome]; return { size: t.length, lastModified: 0, async text() { return t; } }; },
                    async createWritable() { return escritor(raiz, nome); },
                };
            },
            async getDirectoryHandle() { return dirCopias; },
        };
        window.showDirectoryPicker = async () => handle;
    }, inicial);
}
const lerBackup = page => page.evaluate(n => { const t = window.__PASTA.raiz[n]; return t ? JSON.parse(t) : null; }, FICHEIRO);
const avisoVisivel = page => page.evaluate(() => !document.getElementById('backupPastaAviso').classList.contains('hidden'));
const hoje = '2026-09-23';   // DATA_PADRAO dos helpers

describe('Backup na pasta partilhada', () => {
    test('sem ficheiro na pasta: escolher grava logo; uma alteração volta a gravar sozinha', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1, { data: hoje })] },
        });
        try {
            await pastaFalsa(page);
            assert.match(await page.locator('#backupPastaEstado').textContent(), /Nenhuma pasta/);
            await page.evaluate(() => document.getElementById('btnBackupPasta').click());
            await page.waitForFunction(n => !!window.__PASTA.raiz[n], FICHEIRO);
            const a = await lerBackup(page);
            assert.equal(a.registos.length, 1);
            assert.equal(a.updatedAt, a.dataBackup);
            assert.equal(a.totalRegistos, 1);

            await page.evaluate(async d => {
                registos.push({ uuid: 'novo-1', data: d, qtdKanbans: 4, tipoErro: 'KB Danificado', servico: 'UCIP' });
                await salvarDados();
            }, hoje);
            await page.waitForFunction(n => { const t = window.__PASTA.raiz[n]; return t && JSON.parse(t).registos.length === 2; }, FICHEIRO, { timeout: 15000 });
            const b = await lerBackup(page);
            assert.match(await page.locator('#backupPastaEstado').textContent(), /A gravar impreskanban_backup\.json/);
            assert.equal(await avisoVisivel(page), false);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('outra pessoa gravou: pára e avisa, sem gravar por cima; «Abrir a versão da pasta» junta e volta a gravar', async () => {
        const deOutra = JSON.stringify({
            versao: '4.31.0', dataBackup: '2026-09-22T10:00:00.000Z', updatedAt: '2026-09-22T10:00:00.000Z',
            registos: [criarRegisto(50, { data: hoje, uuid: 'da-outra-pessoa' })],
            totalRegistos: 1, totalKanbans: 1,
        });
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1, { data: hoje })] },
        });
        try {
            page.on('dialog', d => d.accept());   // «Importar?» e «Concatenar?» → OK
            await pastaFalsa(page, { [FICHEIRO]: deOutra });
            await page.evaluate(() => document.getElementById('btnBackupPasta').click());
            await page.waitForFunction(() => !document.getElementById('backupPastaAviso').classList.contains('hidden'));
            assert.match(await page.locator('#backupPastaAvisoTxt').textContent(), /gravado .* \(1 registos\)/);
            await page.waitForTimeout(500);
            // Uma alteração com a pasta em conflito não grava por cima.
            await page.evaluate(async d => {
                registos.push({ uuid: 'local-1', data: d, qtdKanbans: 1, tipoErro: 'KB Perdido', servico: 'UCIP' });
                await salvarDados();
            }, hoje);
            await page.waitForTimeout(6000);
            assert.equal((await lerBackup(page)).registos.length, 1);
            assert.equal(await page.evaluate(() => window.__PASTA.escritas), 0);

            await page.evaluate(() => document.getElementById('btnBackupPastaAbrir').click());
            // Junta (concatenar) e, como há alterações por gravar, grava o resultado.
            await page.waitForFunction(n => { const t = window.__PASTA.raiz[n]; return t && JSON.parse(t).registos.length === 3; }, FICHEIRO, { timeout: 15000 });
            const f = await lerBackup(page);
            const uuids = f.registos.map(r => r.uuid);
            assert.ok(uuids.includes('da-outra-pessoa') && uuids.includes('local-1'));
            assert.notEqual(f.updatedAt, '2026-09-22T10:00:00.000Z');
            // A versão da outra pessoa ficou guardada antes de ser substituída.
            const copias = await page.evaluate(() => Object.keys(window.__PASTA.copias));
            assert.equal(copias.length, 1);
            assert.match(copias[0], /^impreskanban_backup_2026-09-22_\d\d-\d\d-\d\d\.json$/);
            assert.equal(await avisoVisivel(page), false);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('«Gravar por cima…» pergunta; se se recusa, a pasta não muda', async () => {
        const deOutra = JSON.stringify({ versao: '4.31.0', dataBackup: '2026-09-22T10:00:00.000Z', updatedAt: '2026-09-22T10:00:00.000Z', registos: [], totalRegistos: 0, totalKanbans: 0 });
        const { context, page } = await abrirApp(browser, url, { storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1, { data: hoje })] } });
        try {
            let perguntas = 0;
            page.on('dialog', d => { perguntas++; d.dismiss(); });
            await pastaFalsa(page, { [FICHEIRO]: deOutra });
            await page.evaluate(() => document.getElementById('btnBackupPasta').click());
            await page.waitForFunction(() => !document.getElementById('backupPastaAviso').classList.contains('hidden'));
            await page.evaluate(() => document.getElementById('btnBackupPastaPorCima').click());
            await page.waitForFunction(() => document.getElementById('btnBackupPastaAgora').disabled === false);
            await page.waitForTimeout(300);
            assert.equal(perguntas, 1);
            assert.equal((await lerBackup(page)).updatedAt, '2026-09-22T10:00:00.000Z');
            assert.equal(await avisoVisivel(page), true);
        } finally {
            await context.close();
        }
    });
});
