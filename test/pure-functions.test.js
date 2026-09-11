// Testes unitários das funções puras (sem DOM) de index.html — extraídas
// diretamente do ficheiro real via scripts/lib/extract-scripts.js, para
// garantir que testamos o código que corre no browser, não uma cópia que
// pode divergir. Ver README/CI: é aqui que os bugs de v4.9.x aconteceram
// de facto (isValorAtivo, validarDuplicados) — os testes fixam esse
// comportamento para não regredir.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregarFuncoesPuras } = require('./../scripts/lib/extract-scripts.js');

describe('isValorAtivo', () => {
    // v4.9.9: comparar só com `=== true` fazia colunas *_ATIVO do Excel
    // (texto/número consoante a formatação da célula) carregarem 0 linhas.
    const { isValorAtivo } = carregarFuncoesPuras(['isValorAtivo']);

    const casosVerdadeiros = [
        true, 1,
        'true', 'TRUE', 'True', '  true  ',
        'verdadeiro', 'VERDADEIRO',
        '1',
        'sim', 'SIM', '  Sim  ',
    ];
    for (const valor of casosVerdadeiros) {
        test(`${JSON.stringify(valor)} é ativo`, () => {
            assert.equal(isValorAtivo(valor), true);
        });
    }

    const casosFalsos = [
        false, 0, -1, 2,
        'false', 'não', 'nao', '0', '',
        null, undefined, {}, [], NaN,
    ];
    for (const valor of casosFalsos) {
        test(`${JSON.stringify(valor)} não é ativo`, () => {
            assert.equal(isValorAtivo(valor), false);
        });
    }
});

describe('normalizarTextoRFID', () => {
    const { normalizarTextoRFID } = carregarFuncoesPuras(['normalizarTextoRFID']);

    test('minúsculas, sem acentos, sem espaços nas pontas', () => {
        assert.equal(normalizarTextoRFID('  Armazém  '), 'armazem');
    });

    test('KB Perdido em várias grafias normaliza para o mesmo texto', () => {
        const variantes = ['KB Perdido', 'kb perdido', '  Kb Pérdído  ', 'KB PERDIDO'];
        const normalizados = new Set(variantes.map(normalizarTextoRFID));
        assert.equal(normalizados.size, 1, `esperava uma única forma normalizada, obtive: ${[...normalizados]}`);
    });

    test('null/undefined não lançam e devolvem string vazia', () => {
        assert.equal(normalizarTextoRFID(null), '');
        assert.equal(normalizarTextoRFID(undefined), '');
    });

    test('valores não-string são convertidos antes de normalizar', () => {
        assert.equal(normalizarTextoRFID(123), '123');
    });
});

describe('obterChaveSemana', () => {
    const { obterChaveSemana } = carregarFuncoesPuras(['obterChaveSemana']);

    // Casos clássicos de teste de semana ISO-8601 (o ano civil e o ano da
    // semana ISO divergem perto da virada do ano):
    test('2026-01-01 (quinta) pertence à semana 1 de 2026', () => {
        assert.equal(obterChaveSemana(new Date(2026, 0, 1)), '2026-W01');
    });

    test('2024-01-01 (segunda) pertence à semana 1 de 2024', () => {
        assert.equal(obterChaveSemana(new Date(2024, 0, 1)), '2024-W01');
    });

    test('2023-01-01 (domingo) pertence à semana 52 de 2022, não à semana 1 de 2023', () => {
        assert.equal(obterChaveSemana(new Date(2023, 0, 1)), '2022-W52');
    });

    test('2021-01-01 (sexta) pertence à semana 53 de 2020', () => {
        assert.equal(obterChaveSemana(new Date(2021, 0, 1)), '2020-W53');
    });

    test('2020-12-31 (quinta) também pertence à semana 53 de 2020', () => {
        assert.equal(obterChaveSemana(new Date(2020, 11, 31)), '2020-W53');
    });

    test('mesma semana civil devolve a mesma chave em qualquer dos seus dias', () => {
        const chaves = [5, 6, 7, 8, 9, 10, 11].map(dia => obterChaveSemana(new Date(2026, 0, dia)));
        assert.deepEqual(new Set(chaves), new Set(['2026-W02']));
    });
});

describe('calcularIntervaloDataRapido', () => {
    // "hoje" é fixado via um Date sandboxed (quarta-feira 14/01/2026,
    // meio-dia local) para que os testes sejam determinísticos — a função
    // real usa `new Date()` sem argumentos.
    function criarContextoComHojeFixo(ano, mes, dia) {
        const RealDate = Date;
        class DataFixada extends RealDate {
            constructor(...args) {
                if (args.length === 0) super(ano, mes, dia, 12, 0, 0);
                else super(...args);
            }
        }
        return { Date: DataFixada };
    }

    const { calcularIntervaloDataRapido } = carregarFuncoesPuras(
        ['calcularIntervaloDataRapido'],
        criarContextoComHojeFixo(2026, 0, 14) // quarta-feira
    );

    function assertData(data, ano, mes, dia, mensagem) {
        assert.equal(data.getFullYear(), ano, `${mensagem}: ano`);
        assert.equal(data.getMonth(), mes, `${mensagem}: mês`);
        assert.equal(data.getDate(), dia, `${mensagem}: dia`);
    }

    test('tipo desconhecido devolve null', () => {
        assert.equal(calcularIntervaloDataRapido('nao-existe'), null);
    });

    test("'hoje': início e fim são o mesmo instante", () => {
        const { dataInicio, dataFim } = calcularIntervaloDataRapido('hoje');
        assert.equal(dataInicio, dataFim); // mesma referência (a=b=new Date())
        assertData(dataInicio, 2026, 0, 14, 'hoje');
    });

    test("'semanaAtual': segunda-feira da semana corrente até hoje", () => {
        const { dataInicio, dataFim } = calcularIntervaloDataRapido('semanaAtual');
        assertData(dataInicio, 2026, 0, 12, 'semanaAtual.dataInicio (segunda)');
        assertData(dataFim, 2026, 0, 14, 'semanaAtual.dataFim (hoje)');
    });

    test("'semanaAnterior': segunda a domingo da semana passada", () => {
        const { dataInicio, dataFim } = calcularIntervaloDataRapido('semanaAnterior');
        assertData(dataInicio, 2026, 0, 5, 'semanaAnterior.dataInicio (segunda)');
        assertData(dataFim, 2026, 0, 11, 'semanaAnterior.dataFim (domingo)');
    });

    test("'mesAtual': dia 1 do mês corrente até hoje", () => {
        const { dataInicio, dataFim } = calcularIntervaloDataRapido('mesAtual');
        assertData(dataInicio, 2026, 0, 1, 'mesAtual.dataInicio');
        assertData(dataFim, 2026, 0, 14, 'mesAtual.dataFim (hoje)');
    });

    test("'mesAnterior': mês inteiro anterior, incluindo o último dia correto", () => {
        const { dataInicio, dataFim } = calcularIntervaloDataRapido('mesAnterior');
        assertData(dataInicio, 2025, 11, 1, 'mesAnterior.dataInicio (1 dez)');
        assertData(dataFim, 2025, 11, 31, 'mesAnterior.dataFim (31 dez)');
    });

    test("'anoAtual': 1 de janeiro do ano corrente até hoje", () => {
        const { dataInicio, dataFim } = calcularIntervaloDataRapido('anoAtual');
        assertData(dataInicio, 2026, 0, 1, 'anoAtual.dataInicio');
        assertData(dataFim, 2026, 0, 14, 'anoAtual.dataFim (hoje)');
    });

    test("'anoAnterior': ano civil anterior completo", () => {
        const { dataInicio, dataFim } = calcularIntervaloDataRapido('anoAnterior');
        assertData(dataInicio, 2025, 0, 1, 'anoAnterior.dataInicio');
        assertData(dataFim, 2025, 11, 31, 'anoAnterior.dataFim');
    });
});

describe('validarDuplicados', () => {
    const registoBase = {
        uuid: 'uuid-1',
        data: '2026-01-10',
        servicoId: 'S1',
        artigo: 'A1',
        armazem: 'ARM1',
        qtdKanbans: 2,
        origem: 'Armazém',
        tipoErro: '',
    };

    function contexto() {
        return carregarFuncoesPuras(['validarDuplicados'], { registos: [{ ...registoBase }] });
    }

    test('registo idêntico é detetado como duplicado', () => {
        const { validarDuplicados } = contexto();
        const encontrado = validarDuplicados({ ...registoBase });
        assert.ok(encontrado);
        assert.equal(encontrado.uuid, 'uuid-1');
    });

    // v4.9.9: validarDuplicados() não considerava origem nem tipoErro,
    // gerando falsos avisos em registos legítimos que só diferiam nesses
    // dois campos.
    test('mesmos dados mas origem diferente NÃO é duplicado', () => {
        const { validarDuplicados } = contexto();
        const resultado = validarDuplicados({ ...registoBase, origem: 'HPH' });
        assert.equal(resultado, undefined);
    });

    test('mesmos dados mas tipoErro diferente NÃO é duplicado', () => {
        const { validarDuplicados } = contexto();
        const resultado = validarDuplicados({ ...registoBase, tipoErro: '5' });
        assert.equal(resultado, undefined);
    });

    for (const campo of ['data', 'servicoId', 'artigo', 'armazem', 'qtdKanbans']) {
        test(`campo "${campo}" diferente NÃO é duplicado`, () => {
            const { validarDuplicados } = contexto();
            const valorDiferente = campo === 'qtdKanbans' ? 99 : `${registoBase[campo]}-diferente`;
            const resultado = validarDuplicados({ ...registoBase, [campo]: valorDiferente });
            assert.equal(resultado, undefined);
        });
    }

    test('ignorarUUID exclui o próprio registo em edição da verificação', () => {
        const { validarDuplicados } = contexto();
        // Sem ignorarUUID, o próprio registo "colide" consigo mesmo
        assert.ok(validarDuplicados({ ...registoBase }));
        // Ao editar esse mesmo registo (mesmo uuid), não deve reportar-se como duplicado de si próprio
        assert.equal(validarDuplicados({ ...registoBase }, 'uuid-1'), undefined);
    });

    test('ignorarUUID não impede deteção de duplicado com OUTRO registo', () => {
        const { validarDuplicados } = carregarFuncoesPuras(['validarDuplicados'], {
            registos: [{ ...registoBase, uuid: 'uuid-1' }, { ...registoBase, uuid: 'uuid-2' }],
        });
        // A editar o uuid-1, mas os dados colidem com o uuid-2 (que não é ignorado)
        const encontrado = validarDuplicados({ ...registoBase }, 'uuid-1');
        assert.ok(encontrado);
        assert.equal(encontrado.uuid, 'uuid-2');
    });
});
