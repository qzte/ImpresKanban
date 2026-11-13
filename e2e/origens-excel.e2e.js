// v4.30.0 — origens por omissão iguais em todos os caminhos e importação de
// Excel que identifica registos pelo UUID.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { iniciarServidor, abrirApp, lerStorageJSON, criarRegisto, REFERENCIAS, chromium } = require('./helpers');

let browser, servidor, url;
before(async () => {
    ({ servidor, url } = await iniciarServidor());
    browser = await chromium.launch();
});
after(async () => {
    await browser?.close();
    servidor?.close();
});

const NOMES_PADRAO = ['Armazém', 'Externo A', 'Externo B'];

describe('Origens por omissão', () => {
    test('arranque, Excel sem T_Origem e "limpar referências" dão as mesmas 3 origens', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: REFERENCIAS, servirFixturesCDN: true, aceitarDialogos: true,
        });
        try {
            assert.deepEqual(await page.evaluate(() => tOrigem.map(o => o.Nome)), NOMES_PADRAO);

            // O ficheiro de exemplo não tem folha T_Origem
            await page.click('#mainTabGestao');
            await page.setInputFiles('#fileReferencia', path.join(__dirname, 'fixtures', 'referencias-exemplo.xlsx'));
            await page.waitForFunction(() => /Referências carregadas/.test(document.getElementById('referenciaAlert').textContent));
            assert.equal(await page.evaluate(() => tOrigem.some(o => o.ID_ORIGEM !== undefined)), false, 'fixture sem T_Origem');
            assert.deepEqual(await page.evaluate(() => tOrigem.map(o => o.Nome)), NOMES_PADRAO);

            await page.evaluate(() => limparReferencia());
            assert.deepEqual(await page.evaluate(() => tOrigem.map(o => o.Nome)), NOMES_PADRAO);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});

describe('Importar registos de Excel', () => {
    async function exportarEImportar(page, antes, linhasExtra = []) {
        // Gera um .xlsx de registos com a própria app e volta a importá-lo
        const buffer = await page.evaluate(async extra => {
            await verificarBibliotecaExcel();
            const wb = XLSX.utils.book_new();
            const linhas = registos.map(r => ({
                UUID: r.uuid, ID: r.id, Data: r.data, 'Serviço ID': r.servicoId, 'Serviço': r.servico,
                Artigo: r.artigo, 'Armazém': r.armazem, Origem: r.origem,
                'Quantidade Kanbans': r.qtdKanbans, 'Tipo Erro': r.tipoErro,
            })).concat(extra);
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Registos');
            return Array.from(new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
        }, linhasExtra);
        return { name: 'registos.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(buffer) };
    }

    test('só o UUID decide: registo igual nos campos mas com UUID novo é importado', async () => {
        const base = criarRegisto(1);
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [base] },
            servirFixturesCDN: true, aceitarDialogos: true,
        });
        try {
            const gemeo = { UUID: 'outro-uuid', ID: 7, Data: base.data, 'Serviço ID': base.servicoId, 'Serviço': base.servico,
                Artigo: base.artigo, 'Armazém': base.armazem, Origem: base.origem,
                'Quantidade Kanbans': base.qtdKanbans, 'Tipo Erro': base.tipoErro };
            const ficheiro = await exportarEImportar(page, base, [gemeo]);
            await page.setInputFiles('#fileBackup', ficheiro);
            await page.waitForFunction(() => /Importação concluída/.test(document.getElementById('importAlert').textContent));

            const uuids = (await lerStorageJSON(page, 'kanban_registos')).map(r => r.uuid).sort();
            assert.deepEqual(uuids, ['outro-uuid', 'seed-1'], 'seed-1 já existia (ignorado); o gémeo entra');
            assert.match(await page.textContent('#importAlert'), /1 duplicados ignorados/);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('linhas sem UUID continuam a ser comparadas pelos campos', async () => {
        const base = criarRegisto(1);
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [base] },
            servirFixturesCDN: true, aceitarDialogos: true,
        });
        try {
            const semUuid = { Data: base.data, 'Serviço ID': base.servicoId, 'Serviço': base.servico,
                Artigo: base.artigo, 'Armazém': base.armazem, Origem: base.origem,
                'Quantidade Kanbans': base.qtdKanbans, 'Tipo Erro': base.tipoErro };
            await page.setInputFiles('#fileBackup', await (async () => {
                const buf = await page.evaluate(async l => {
                    await verificarBibliotecaExcel();
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([l]), 'Registos');
                    return Array.from(new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
                }, semUuid);
                return { name: 'antigo.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(buf) };
            })());
            await page.waitForFunction(() => /Importação concluída/.test(document.getElementById('importAlert').textContent));
            assert.equal((await lerStorageJSON(page, 'kanban_registos')).length, 1);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});
