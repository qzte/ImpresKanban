// Histórico: paginação (v4.19.0), filtros, edição e eliminação de registos.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
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

async function abrirHistorico(page) {
    await page.click('#opTabHistorico');
    await page.waitForSelector('#histDataTable tr');
}

const contarLinhas = page => page.locator('#histDataTable tr').count();

describe('Histórico', () => {
    test('pagina de 100 em 100 e as estatísticas contam todos os filtrados', async () => {
        const registos = Array.from({ length: 250 }, (_, i) =>
            criarRegisto(i, i < 30 ? { servicoId: '202', servico: 'Pediatria' } : {})
        );
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: registos },
        });
        try {
            await abrirHistorico(page);
            assert.equal(await contarLinhas(page), 100);
            assert.equal(await page.textContent('#histTotalRegistos'), '250');
            assert.equal(await page.textContent('#histPaginacaoInfo'), 'A mostrar 100 de 250 registos');

            await page.click('#btnHistMostrarMais');
            assert.equal(await contarLinhas(page), 200);
            assert.match(await page.textContent('#btnHistMostrarMais'), /Mostrar mais 50/);

            await page.click('#btnHistMostrarMais');
            assert.equal(await contarLinhas(page), 250);
            assert.ok(await page.isHidden('#histPaginacao'), 'sem botão quando já está tudo');

            // Filtro de texto com pesquisa em tempo real (debounce 250ms)
            await page.fill('#histServico', 'pediatria');
            await page.waitForFunction(() => document.querySelectorAll('#histDataTable tr').length === 30);
            assert.equal(await page.textContent('#histTotalRegistos'), '30');
            assert.ok(await page.isHidden('#histPaginacao'));

            // Filtros novos voltam à primeira página
            await page.fill('#histServico', '');
            await page.waitForFunction(() => document.querySelectorAll('#histDataTable tr').length === 100);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('ordena do mais recente para o mais antigo', async () => {
        const registos = [
            criarRegisto(1, { data: '2026-03-10' }),
            criarRegisto(2, { data: '2026-09-01' }),
            criarRegisto(3, { data: '2026-06-15' }),
        ];
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: registos },
        });
        try {
            await abrirHistorico(page);
            const datas = await page.locator('#histDataTable tr td:first-child').allTextContents();
            assert.deepEqual(datas, ['01/09/2026', '15/06/2026', '10/03/2026']);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('eliminar remove logo a linha e mantém as páginas abertas', async () => {
        const registos = Array.from({ length: 150 }, (_, i) => criarRegisto(i));
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: registos },
        });
        try {
            await abrirHistorico(page);
            await page.click('#btnHistMostrarMais');
            assert.equal(await contarLinhas(page), 150);

            const uuidAlvo = await page.locator('#histDataTable .btn-acao-eliminar').nth(120).getAttribute('data-uuid');
            page.once('dialog', d => d.accept());
            await page.locator('#histDataTable .btn-acao-eliminar').nth(120).click();

            assert.equal(await contarLinhas(page), 149);
            assert.equal(await page.textContent('#histTotalRegistos'), '149');
            assert.equal(await page.locator(`#histDataTable [data-uuid="${uuidAlvo}"]`).count(), 0);
            const gravados = await lerStorageJSON(page, 'kanban_registos');
            assert.equal(gravados.length, 149);
            assert.ok(!gravados.some(r => r.uuid === uuidAlvo));
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('eliminar cancelado não altera nada', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1)] },
        });
        try {
            await abrirHistorico(page);
            page.once('dialog', d => d.dismiss());
            await page.click('#histDataTable .btn-acao-eliminar');
            assert.equal(await contarLinhas(page), 1);
            assert.equal((await lerStorageJSON(page, 'kanban_registos')).length, 1);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('editar abre o formulário preenchido e grava sobre o mesmo registo', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1, { qtdKanbans: 1 })] },
        });
        try {
            await abrirHistorico(page);
            await page.click('#histDataTable .btn-acao-editar');
            await page.waitForFunction(() => document.getElementById('servicoId').value === '101');
            assert.ok(await page.isVisible('#btnCancelarEdicao'), 'modo edição ativo');

            await page.fill('#qtdKanbans', '7');
            await page.click('#kanbanForm button[type="submit"]');

            const gravados = await lerStorageJSON(page, 'kanban_registos');
            assert.equal(gravados.length, 1, 'edição não cria um registo novo');
            assert.equal(gravados[0].uuid, 'seed-1');
            assert.equal(gravados[0].qtdKanbans, 7);
            assert.match(await page.textContent('#importAlert'), /Registo atualizado com sucesso/);
            assert.ok(await page.isHidden('#btnCancelarEdicao'), 'sai do modo edição');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});
