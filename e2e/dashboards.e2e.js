// Filtros dos 3 dashboards (Operacional, Gestão, Qualidade) — todos passam
// por criarFiltroDashboard()/ligarFiltroDashboard() (v4.22.0). Antes disso
// não havia nenhum teste de interface nesta área; o Operacional tinha a
// sua própria cópia de filtroRapido/aplicarFiltro/limparFiltro em vez de
// usar a fábrica partilhada com Gestão e Qualidade.

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

// 3 registos em anos diferentes (2 no ano atual, 1 no anterior) e 2 origens
// distintas do que a app usa por omissão quando não há T_Origem carregada
// (Armazém/Externo A/Externo B — ver carregarReferencias())
function seed() {
    return [
        criarRegisto(1, { data: '2026-09-23', origem: 'Armazém' }),
        criarRegisto(2, { data: '2026-09-01', origem: 'Externo A' }),
        criarRegisto(3, { data: '2025-01-01', origem: 'Armazém' }),
    ];
}

describe('Dashboard Operacional', () => {
    test('filtroRapido + limparFiltroOperacional filtram por data', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: seed() },
        });
        try {
            await page.click('#mainTabDashboards');
            assert.equal(await page.textContent('#opRegistosHoje'), '1', 'por omissão mostra "hoje"');

            await page.click(`button[onclick="filtroRapido('anoAtual')"]`);
            assert.equal(await page.inputValue('#opDataInicio'), '2026-01-01');
            assert.equal(await page.textContent('#opRegistosHoje'), '2', 'só os 2 registos de 2026');

            await page.click('button[onclick="limparFiltroOperacional()"]');
            assert.equal(await page.inputValue('#opDataInicio'), '');
            assert.equal(await page.textContent('#opRegistosHoje'), '1', 'volta a "hoje"');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});

describe('Dashboard Gestão', () => {
    test('filtro de origem + filtroRapidoGestao/limparFiltroGestao', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: seed() },
        });
        try {
            await page.click('#mainTabDashboards');
            await page.click('#dashTabGestao');
            assert.equal(await page.textContent('#gestaoTotalRegistos'), '3');

            // Clicar "Todas" com tudo ativo desativa tudo (toggleOrigem('todas'));
            // clicar de seguida "Externo A" ativa só essa — isola-a
            await page.locator('#containerBotoesOrigemGestao button').filter({ hasText: 'Todas' }).click();
            await page.locator('#containerBotoesOrigemGestao button').filter({ hasText: 'Externo A' }).click();
            assert.equal(await page.textContent('#gestaoTotalRegistos'), '1', 'só o registo de Externo A');

            await page.click('button[onclick="limparFiltroGestao()"]');
            assert.equal(await page.textContent('#gestaoTotalRegistos'), '3', 'origem reposta a todas');

            await page.click(`button[onclick="filtroRapidoGestao('anoAtual')"]`);
            assert.equal(await page.inputValue('#gestaoDataInicio'), '2026-01-01');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});

describe('Dashboard Qualidade', () => {
    test('filtroRapidoQualidade/limparFiltroQualidade e alternar dashboard não perde os botões de origem', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: seed() },
        });
        try {
            await page.click('#mainTabDashboards');
            await page.click('#dashTabQualidade');
            await page.click(`button[onclick="filtroRapidoQualidade('anoAtual')"]`);
            assert.equal(await page.inputValue('#qualDataInicio'), '2026-01-01');

            await page.click('button[onclick="limparFiltroQualidade()"]');
            assert.equal(await page.inputValue('#qualDataInicio'), '');

            // atualizarBotoesOrigem() global (Gestão) é chamada por
            // mudarDashboard() ao reabrir a tab — confirma que continua
            // ligada ao objeto certo depois do refactor dos wrappers
            await page.click('#dashTabGestao');
            await page.waitForTimeout(100);
            await expectOrigemBotoesVisiveis(page);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});

async function expectOrigemBotoesVisiveis(page) {
    const n = await page.locator('#containerBotoesOrigemGestao button').count();
    assert.ok(n > 0, 'botões de origem da Gestão continuam a ser desenhados');
}
