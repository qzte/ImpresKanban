// Backups: exportar/importar JSON, lembrete semanal obrigatório e
// recuperação quando os dados guardados estão corrompidos. É aqui que um
// erro significa perder dados, por isso cada fluxo lê o que ficou gravado.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
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

async function lerDownload(download) {
    return JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
}

function ficheiroBackup(registos, extra = {}) {
    return {
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ versao: 'teste', dataBackup: '2026-09-20T10:00:00Z', registos, ...extra })),
    };
}

describe('Backup JSON', () => {
    test('exportar descarrega todos os dados e marca o backup como recente', async () => {
        const registos = [criarRegisto(1), criarRegisto(2, { qtdKanbans: 3 })];
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: registos },
        });
        try {
            // Referências carregadas mas nunca houve backup em ficheiro → amarelo
            assert.match(await page.getAttribute('#mainTabGestao', 'class'), /tab-status-warning/);

            await page.click('#mainTabGestao');
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.click('button[onclick="fazerBackup()"]'),
            ]);
            assert.equal(download.suggestedFilename(), 'Kanban_Backup_2026-09-23.json');

            const backup = await lerDownload(download);
            assert.deepEqual(backup.registos.map(r => r.uuid), ['seed-1', 'seed-2']);
            assert.equal(backup.totalRegistos, 2);
            assert.equal(backup.totalKanbans, 4);
            assert.equal(backup.tArtigo.length, 2, 'inclui as referências');

            assert.match(await page.getAttribute('#mainTabGestao', 'class'), /tab-status-success/);
            assert.equal(await page.textContent('#backupTimestamp'), '23/09/2026, 10:00');
            // O backup automático no localStorage foi removido em v4.18.0
            assert.equal(await page.evaluate(() => localStorage.getItem('kanban_backup')), null);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('importar em modo Concatenar junta registos sem duplicar por UUID', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1), criarRegisto(2)] },
        });
        try {
            const dialogos = [];
            page.on('dialog', d => { dialogos.push(d.message()); d.accept(); }); // importar? OK; concatenar? OK
            await page.setInputFiles('#fileBackup', ficheiroBackup([criarRegisto(2), criarRegisto(3)]));
            await page.waitForFunction(() => registos.length === 3);

            assert.equal(dialogos.length, 2);
            assert.match(dialogos[1], /Concatenar com os dados atuais/);
            const uuids = (await lerStorageJSON(page, 'kanban_registos')).map(r => r.uuid).sort();
            assert.deepEqual(uuids, ['seed-1', 'seed-2', 'seed-3']);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('importar em modo Substituir troca os registos pelos do backup', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1), criarRegisto(2)] },
        });
        try {
            let n = 0;
            page.on('dialog', d => (n++ === 0 ? d.accept() : d.dismiss())); // importar? OK; concatenar? Cancelar
            await page.setInputFiles('#fileBackup', ficheiroBackup([criarRegisto(9)]));
            await page.waitForFunction(() => registos.length === 1);

            const gravados = await lerStorageJSON(page, 'kanban_registos');
            assert.deepEqual(gravados.map(r => r.uuid), ['seed-9']);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('ficheiro inválido é rejeitado sem tocar nos dados', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1)] },
        });
        try {
            await page.setInputFiles('#fileBackup', {
                name: 'backup.json', mimeType: 'application/json',
                buffer: Buffer.from(JSON.stringify({ registos: 'não é uma lista' })),
            });
            await page.waitForFunction(() => /inválido/.test(document.getElementById('importAlert').textContent));
            assert.equal((await lerStorageJSON(page, 'kanban_registos')).length, 1);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});

describe('Backup semanal', () => {
    // Sexta-feira = BACKUP_DIA_SEMANA
    const SEXTA = new Date('2026-09-25T10:00:00+01:00');

    test('à sexta o modal obriga ao backup e não volta a aparecer na mesma semana', async () => {
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: [criarRegisto(1)] },
            agora: SEXTA,
        });
        try {
            await page.waitForSelector('#modalBackupSemanal:not(.hidden)');
            assert.equal(await page.textContent('#backupSemanalSemana'), '2026-W39');

            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.click('#btnConfirmarBackupSemanal'),
            ]);
            assert.equal(download.suggestedFilename(), 'Kanban_Backup_Semanal_20260925.json');
            assert.equal((await lerDownload(download)).registos.length, 1);
            assert.ok(await page.isHidden('#modalBackupSemanal'));
            assert.match(await page.getAttribute('#mainTabGestao', 'class'), /tab-status-success/);

            await page.reload();
            await page.waitForFunction(() => typeof registos !== 'undefined');
            await page.waitForTimeout(2000); // verificarBackupSemanal corre 1,5s após o arranque
            assert.ok(await page.isHidden('#modalBackupSemanal'), 'já feito esta semana');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});

describe('Recuperação', () => {
    test('dados corrompidos: oferece a cópia legada (≤ v4.17.0) e restaura-a', async () => {
        const legado = { dataBackup: '2026-09-01T10:00:00Z', registos: [criarRegisto(1), criarRegisto(2)] };
        const { context, page, erros } = await abrirApp(browser, url, {
            storage: { ...REFERENCIAS, kanban_registos: '{corrompido', kanban_backup: legado },
            aceitarDialogos: true, // "Deseja restaurar esse backup agora?" — aberto no arranque
        });
        try {
            await page.waitForFunction(() => registos.length === 2);
            assert.equal((await lerStorageJSON(page, 'kanban_registos')).length, 2);

            // No arranque seguinte os dados já estão bons e a cópia é apagada
            await page.reload();
            await page.waitForFunction(() => typeof registos !== 'undefined' && registos.length === 2);
            assert.equal(await page.evaluate(() => localStorage.getItem('kanban_backup')), null);
            // O erro original de parse é registado com console.error — esperado aqui
            assert.ok(erros.every(e => /corrompid|JSON|Erro ao carregar/i.test(e)), erros.join('\n'));
        } finally {
            await context.close();
        }
    });
});
