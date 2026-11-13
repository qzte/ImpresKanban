// Relatórios PDF — período do briefing mensal (v4.29.0).
// O período era calculado com toISOString() (UTC): na hora de verão de
// Lisboa (UTC+1) recuava um dia — setembro ia de 31 ago a 29 set, incluindo
// um dia do mês anterior e deixando de fora o último dia do mês.

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

async function pedirBriefingMensal(page) {
    await page.click('#mainTabRelatorios');
    await page.click('button[onclick="selecionarPeriodoMensal(\'atual\')"]');
    await page.waitForFunction(() => !document.getElementById('btnGerarMensal').disabled);
}

describe('Briefing mensal (relógio em 23 Set 2026, hora de verão)', () => {
    test('o último dia do mês entra no relatório', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1, { data: '2026-09-30' })] },
            servirFixturesCDN: true,
        });
        try {
            await pedirBriefingMensal(page);
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.click('#btnGerarMensal'),
            ]);
            assert.match(download.suggestedFilename(), /\.pdf$/);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('o último dia do mês anterior fica de fora', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1, { data: '2026-08-31' })] },
            servirFixturesCDN: true,
        });
        try {
            await pedirBriefingMensal(page);
            await page.click('#btnGerarMensal');
            await page.waitForFunction(() => /Sem Dados para o Período/.test(document.getElementById('importAlert').textContent));
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});
