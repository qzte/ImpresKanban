// Arranque e registo individual (formulário "Identificação") — o fluxo que o
// operador usa todos os dias.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { iniciarServidor, abrirApp, lerStorageJSON, REFERENCIAS, chromium } = require('./helpers');

const APP_VERSION = /APP_VERSION\s*=\s*'([\d.]+)'/.exec(
    fs.readFileSync(path.join(__dirname, '..', 'version.js'), 'utf8')
)[1];

let browser, servidor, url;
before(async () => {
    ({ servidor, url } = await iniciarServidor());
    browser = await chromium.launch();
});
after(async () => {
    await browser?.close();
    servidor?.close();
});

async function preencherRegisto(page, { servicoId = '101', artigo = '12345', qtd = '2' } = {}) {
    await page.selectOption('#utilizadorUUID', 'user-1');
    await page.fill('#servicoId', servicoId);
    await page.fill('#artigo', artigo);
    await page.selectOption('#origem', 'Armazém');
    await page.fill('#qtdKanbans', qtd);
    await page.selectOption('#tipoErro', '1');
}

const submeter = page => page.click('#kanbanForm button[type="submit"]');

describe('Arranque', () => {
    test('sem dados: arranca sem erros e sem logs de diagnóstico', async () => {
        const { context, page, erros, logs } = await abrirApp(browser, url);
        try {
            assert.equal(await page.title(), `Análise KPI - Manutenção Kanban v${APP_VERSION}`);
            assert.ok(await page.isVisible('#kanbanForm'), 'formulário de registo visível');
            assert.ok(await page.isHidden('#modalBackupSemanal'), 'sem modal de backup fora do dia');
            assert.deepEqual(erros, []);
            // console.log só com kanban_debug=1 (v4.18.0)
            assert.deepEqual(logs, []);
        } finally {
            await context.close();
        }
    });
});

describe('Registo individual', () => {
    test('grava o registo com os valores canónicos das referências', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFERENCIAS });
        try {
            await preencherRegisto(page);
            // Armazém é preenchido a partir do artigo (campo readonly)
            assert.equal(await page.inputValue('#armazem'), 'A1');
            await submeter(page);

            const registos = await lerStorageJSON(page, 'kanban_registos');
            assert.equal(registos.length, 1);
            const r = registos[0];
            assert.equal(r.artigo, '0000012345', 'código gravado com os 10 dígitos');
            assert.equal(r.artigoDescricao, 'Luvas Nitrilo M');
            assert.equal(r.servico, 'Urgência');
            assert.equal(r.utilizadorNome, 'Ana Silva');
            assert.equal(r.qtdKanbans, 2);
            assert.equal(r.data, '2026-09-23', 'data preenchida com o dia atual');
            assert.ok(r.uuid);

            assert.match(await page.textContent('#importAlert'), /Registo adicionado com sucesso/);
            assert.equal(await page.inputValue('#servicoId'), '', 'formulário limpo após gravar');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('rejeita serviço que não existe nas referências', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFERENCIAS });
        try {
            await preencherRegisto(page, { servicoId: '999' });
            await submeter(page);
            assert.equal(await page.evaluate(() => localStorage.getItem('kanban_registos')), null);
            assert.match(await page.textContent('#importAlert'), /Serviço não existe nas referências/);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('duplicado pede confirmação; cancelar não grava', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFERENCIAS });
        try {
            await preencherRegisto(page);
            await submeter(page);

            const dialogos = [];
            page.on('dialog', d => { dialogos.push(d.message()); d.dismiss(); });
            await preencherRegisto(page);
            await submeter(page);

            assert.equal(dialogos.length, 1);
            assert.match(dialogos[0], /AVISO DE DUPLICADO/);
            assert.equal((await lerStorageJSON(page, 'kanban_registos')).length, 1);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('registo gravado aparece no Histórico e sobrevive a um reload', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFERENCIAS });
        try {
            await preencherRegisto(page);
            await submeter(page);
            await page.reload();
            await page.waitForFunction(() => typeof registos !== 'undefined' && registos.length === 1);

            await page.click('#opTabHistorico');
            await page.waitForSelector('#histDataTable tr .btn-acao-editar');
            const linhas = page.locator('#histDataTable tr');
            assert.equal(await linhas.count(), 1);
            const texto = await linhas.first().textContent();
            assert.match(texto, /Urgência/);
            assert.match(texto, /Luvas Nitrilo M/);
            assert.match(texto, /Sem erro/, 'mostra a descrição do tipo de erro, não o código');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});
