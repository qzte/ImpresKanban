// Registo em Batch (Múltiplos Artigos / Múltiplos Serviços) — v4.29.0.
// O batch tem de aplicar as mesmas regras do registo individual: serviço e
// artigo existentes nas referências, forma canónica, quantidade válida e
// aviso de duplicados. É tudo ou nada: com uma linha inválida não grava.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor, abrirApp, lerStorageJSON, REFERENCIAS, chromium } = require('./helpers');

// ID de serviço numérico, como o Excel o devolve quando a coluna é numérica
const REFS = {
    ...REFERENCIAS,
    kanban_ref_servicos: [
        { ID_Servico: 101, Servico: 'Urgência', Local: 'Piso 0' },
        { ID_Servico: 202, Servico: 'Pediatria', Local: 'Piso 2' },
    ],
};

let browser, servidor, url;
before(async () => {
    ({ servidor, url } = await iniciarServidor());
    browser = await chromium.launch();
});
after(async () => {
    await browser?.close();
    servidor?.close();
});

const alerta = page => page.textContent('#importAlert');
const esperarAlerta = (page, regex) => page.waitForFunction(
    fonte => new RegExp(fonte).test(document.getElementById('importAlert').textContent), regex.source
);

async function abrirBatchArtigos(page, { servicoId = '101' } = {}) {
    await page.evaluate(() => mudarOpTab('batch'));
    await page.fill('#batchData', '2026-09-23');
    await page.selectOption('#batchUtilizador', 'user-1');
    await page.fill('#batchServicoId', servicoId);
    await page.selectOption('#batchOrigem', 'Armazém');
    await page.selectOption('#batchTipoErro', '1');
}

async function adicionarArtigo(page, codigo, qtd) {
    await page.evaluate(() => adicionarLinhaArtigo());
    const linha = page.locator('#batchArtigosContainer > div').last();
    await linha.locator('.batch-artigo-codigo').fill(codigo);
    await linha.locator('.batch-artigo-qtd').fill(qtd);
    return linha;
}

describe('Batch — Múltiplos Artigos', () => {
    test('grava a forma canónica: código sem zeros e ID de serviço numérico', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFS });
        try {
            await abrirBatchArtigos(page);
            assert.match(await page.textContent('#batchServicoHint'), /Urgência/);
            const linha = await adicionarArtigo(page, '12345', '3');
            assert.equal(await linha.locator('.batch-artigo-hint').textContent(), 'Luvas Nitrilo M');
            assert.equal(await linha.locator('.batch-artigo-armazem').inputValue(), 'A1');
            await adicionarArtigo(page, '0000067890', '1');

            await page.evaluate(() => processarBatch());
            await esperarAlerta(page, /Batch processado com sucesso/);

            const gravados = await lerStorageJSON(page, 'kanban_registos');
            assert.deepEqual(
                gravados.map(r => [r.servicoId, r.servico, r.local, r.artigo, r.armazem, r.qtdKanbans]),
                [['101', 'Urgência', 'Piso 0', '0000012345', 'A1', 3],
                 ['101', 'Urgência', 'Piso 0', '0000067890', 'B2', 1]]
            );
            assert.equal(await page.locator('#batchArtigosContainer > div').count(), 0, 'formulário limpo');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('serviço que não existe nas referências não é gravado', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFS });
        try {
            await abrirBatchArtigos(page, { servicoId: '999' });
            await adicionarArtigo(page, '12345', '1');
            await page.evaluate(() => processarBatch());
            await esperarAlerta(page, /ID de Serviço não existe/);
            assert.equal(await lerStorageJSON(page, 'kanban_registos'), null);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('tudo ou nada: uma linha inválida impede a gravação e o formulário fica como está', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFS });
        try {
            await abrirBatchArtigos(page);
            await adicionarArtigo(page, '12345', '2');
            await adicionarArtigo(page, '67890', '-3');   // quantidade negativa
            await adicionarArtigo(page, '55555', '1');    // artigo inexistente
            await page.evaluate(() => processarBatch());
            await esperarAlerta(page, /Batch não gravado/);

            const texto = await alerta(page);
            assert.match(texto, /Artigo 2: Qtd Kanbans/);
            assert.match(texto, /Artigo 3: Código "55555" não existe/);
            assert.equal(await lerStorageJSON(page, 'kanban_registos'), null);
            assert.equal(await page.evaluate(() => registos.length), 0);
            assert.equal(await page.locator('#batchArtigosContainer > div').count(), 3, 'linhas mantidas para corrigir');
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('avisa de duplicados; recusar o aviso não grava', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFS });
        try {
            const dialogos = [];
            page.on('dialog', d => { dialogos.push(d.message()); d.dismiss(); });
            await abrirBatchArtigos(page);
            await adicionarArtigo(page, '12345', '2');
            await adicionarArtigo(page, '0000012345', '2'); // a mesma linha, repetida
            await page.evaluate(() => processarBatch());

            assert.equal(dialogos.length, 1);
            assert.match(dialogos[0], /1 de 2 linha\(s\) repetem/);
            assert.equal(await page.evaluate(() => registos.length), 0);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});

describe('Batch — Múltiplos Serviços', () => {
    async function abrirBatchServicos(page) {
        await page.evaluate(() => { mudarOpTab('batch'); mudarModoBatch('servicos'); });
        await page.fill('#batchSvcData', '2026-09-23');
        await page.selectOption('#batchSvcUtilizador', 'user-1');
        await page.fill('#batchSvcArtigo', '12345');
        await page.selectOption('#batchSvcOrigem', 'Armazém');
        await page.selectOption('#batchSvcTipoErro', '1');
    }
    async function adicionarServico(page, id, qtd = '1') {
        await page.evaluate(() => adicionarLinhaServico());
        const linha = page.locator('#batchServicosContainer > div').last();
        await linha.locator('.batch-svc-id').fill(id);
        await linha.locator('.batch-svc-qtd').fill(qtd);
    }

    test('grava um registo por serviço, com o artigo na forma canónica', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFS });
        try {
            await abrirBatchServicos(page);
            assert.equal(await page.inputValue('#batchSvcArmazem'), 'A1');
            await adicionarServico(page, '101', '2');
            await adicionarServico(page, '202', '4');
            await page.evaluate(() => processarBatchServicos());
            await esperarAlerta(page, /Batch processado com sucesso/);

            const gravados = await lerStorageJSON(page, 'kanban_registos');
            assert.deepEqual(
                gravados.map(r => [r.servicoId, r.servico, r.artigo, r.qtdKanbans]),
                [['101', 'Urgência', '0000012345', 2], ['202', 'Pediatria', '0000012345', 4]]
            );
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });

    test('serviço inexistente numa linha impede a gravação de todas', async () => {
        const { context, page, erros } = await abrirApp(browser, url, { storage: REFS });
        try {
            await abrirBatchServicos(page);
            await adicionarServico(page, '101');
            await adicionarServico(page, '999');
            await page.evaluate(() => processarBatchServicos());
            await esperarAlerta(page, /Batch não gravado/);
            assert.match(await alerta(page), /Serviço 2: ID "999" não existe/);
            assert.equal(await lerStorageJSON(page, 'kanban_registos'), null);
            assert.deepEqual(erros, []);
        } finally {
            await context.close();
        }
    });
});

describe('Alertas', () => {
    test('<strong> é formatação e não texto; o resto continua escapado', async () => {
        const { context, page } = await abrirApp(browser, url);
        try {
            await page.evaluate(() => mostrarAlerta('✅ ok<br><strong>Ficheiro:</strong> <img src=x onerror=alert(1)>', 'success'));
            const html = await page.innerHTML('#importAlert');
            assert.equal(html, '<span>✅ ok<br><strong>Ficheiro:</strong> &lt;img src=x onerror=alert(1)&gt;</span>');
            await page.evaluate(() => mostrarAlerta('falhou', 'error'));
            assert.match(await page.getAttribute('#importAlert', 'class'), /alert-warning/);
            assert.match(await alerta(page), /^❌falhou$/);
        } finally {
            await context.close();
        }
    });
});
