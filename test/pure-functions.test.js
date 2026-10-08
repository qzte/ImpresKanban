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
        const resultado = validarDuplicados({ ...registoBase, origem: 'Externo A' });
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

describe('encontrarServico / encontrarArtigo / encontrarErro', () => {
    const tServicos = [
        { ID_Servico: '123', Servico: 'Manutenção Caixa 1', Local: 'Loja A' },
    ];
    const tArtigo = [
        { CODIGO: '0000012345', DESCRICAO_CODIGO: 'Kanban Tipo A', ARMAZEM: 'A1' },
    ];
    const tErros = [
        { Codigo: '5', Descricao: 'KB Perdido' },
    ];

    const { encontrarServico, encontrarArtigo, encontrarErro } = carregarFuncoesPuras(
        ['encontrarServico', 'encontrarArtigo', 'encontrarErro', 'obterIndiceReferencia'],
        { tServicos, tArtigo, tErros }
    );

    test('encontrarServico encontra pelo ID exato', () => {
        assert.equal(encontrarServico('123'), tServicos[0]);
    });

    test('encontrarServico devolve undefined para ID inexistente ou vazio', () => {
        assert.equal(encontrarServico('999'), undefined);
        assert.equal(encontrarServico(''), undefined);
        assert.equal(encontrarServico(null), undefined);
    });

    test('encontrarArtigo aceita o código sem zeros à esquerda (v4.11.2)', () => {
        assert.equal(encontrarArtigo('12345'), tArtigo[0]);
    });

    test('encontrarArtigo aceita a forma canónica de 10 dígitos', () => {
        assert.equal(encontrarArtigo('0000012345'), tArtigo[0]);
    });

    test('encontrarArtigo devolve undefined para código inexistente', () => {
        assert.equal(encontrarArtigo('99999'), undefined);
    });

    test('encontrarErro compara o código como texto (v4.11.2)', () => {
        // CODIGO_ERRO pode vir do Excel como número; a comparação é sempre em texto
        assert.equal(encontrarErro(5), tErros[0]);
        assert.equal(encontrarErro('5'), tErros[0]);
    });

    test('encontrarErro devolve undefined para código inexistente', () => {
        assert.equal(encontrarErro('999'), undefined);
    });
});

describe('obterIndiceReferencia (índice das pesquisas encontrar*)', () => {
    // v4.18.0: as pesquisas passaram de .find() para um Map em cache por
    // array — estes testes fixam que a cache não devolve dados obsoletos
    // e que a semântica "primeira ocorrência" do .find() se mantém.
    test('uma tabela reatribuída (ex.: novo ficheiro de referência) gera índice novo', () => {
        const ctx = carregarFuncoesPuras(['encontrarArtigo', 'obterIndiceReferencia'], {
            tArtigo: [{ CODIGO: '0000000001', DESCRICAO_CODIGO: 'Antigo' }],
        });
        assert.equal(ctx.encontrarArtigo('1').DESCRICAO_CODIGO, 'Antigo');
        ctx.tArtigo = [{ CODIGO: '0000000002', DESCRICAO_CODIGO: 'Novo' }];
        assert.equal(ctx.encontrarArtigo('1'), undefined);
        assert.equal(ctx.encontrarArtigo('2').DESCRICAO_CODIGO, 'Novo');
    });

    test('com chaves duplicadas devolve a primeira ocorrência, como .find()', () => {
        const tServicos = [
            { ID_Servico: 7, Servico: 'Primeiro' },
            { ID_Servico: '7', Servico: 'Segundo' },
        ];
        const { encontrarServico } = carregarFuncoesPuras(
            ['encontrarServico', 'obterIndiceReferencia'], { tServicos }
        );
        assert.equal(encontrarServico('7'), tServicos[0]);
    });

    test('encontrarArtigo com as duas formas presentes devolve a que aparece primeiro', () => {
        const tArtigo = [
            { CODIGO: '0000012345', DESCRICAO_CODIGO: 'Canónico' },
            { CODIGO: '12345', DESCRICAO_CODIGO: 'Curto' },
        ];
        const { encontrarArtigo } = carregarFuncoesPuras(
            ['encontrarArtigo', 'obterIndiceReferencia'], { tArtigo }
        );
        assert.equal(encontrarArtigo('12345'), tArtigo[0]);
    });
});

describe('mergeReferencia', () => {
    const { mergeReferencia } = carregarFuncoesPuras(['mergeReferencia']);

    // `mergeReferencia` corre num vm.Context isolado (ver extract-scripts.js)
    // — os arrays/objetos que devolve pertencem a esse "realm" e têm um
    // Array.prototype/Object.prototype diferentes dos literais deste
    // ficheiro, pelo que assert.deepEqual falha por prototype mismatch
    // mesmo com o mesmo conteúdo. JSON.parse(JSON.stringify(...)) devolve
    // um valor "normal" deste realm, sem esse problema.
    const paraHost = valor => JSON.parse(JSON.stringify(valor));

    test('junta duas listas sem duplicar por chave', () => {
        const atual = [{ CODIGO: 'A', valor: 1 }, { CODIGO: 'B', valor: 2 }];
        const novo = [{ CODIGO: 'B', valor: 99 }, { CODIGO: 'C', valor: 3 }];
        const resultado = mergeReferencia(atual, novo, 'CODIGO');
        assert.deepEqual(paraHost(resultado.map(r => r.CODIGO)), ['A', 'B', 'C']);
        // Em conflito de chave, mantém a entrada atual (v4.15.0)
        assert.equal(resultado.find(r => r.CODIGO === 'B').valor, 2);
    });

    test('trata entradas não-array como listas vazias', () => {
        assert.deepEqual(paraHost(mergeReferencia(null, undefined, 'CODIGO')), []);
        assert.deepEqual(paraHost(mergeReferencia(undefined, [{ CODIGO: 'A' }], 'CODIGO')), [{ CODIGO: 'A' }]);
    });

    test('itens sem a chave são sempre adicionados (nunca considerados duplicados)', () => {
        const resultado = mergeReferencia([{ CODIGO: 'A' }], [{}, {}], 'CODIGO');
        assert.equal(resultado.length, 3);
    });
});

describe('isRegistoErroKBPerdido', () => {
    const tErros = [{ Codigo: '5', Descricao: 'KB Perdido' }];
    const { isRegistoErroKBPerdido } = carregarFuncoesPuras(
        ['isRegistoErroKBPerdido', 'encontrarErro', 'obterIndiceReferencia', 'textoIndicaKBPerdido', 'normalizarTextoRFID'],
        { tErros, ALIASES_KB_PERDIDO: ['kb perdido', 'kanban perdido'] }
    );

    test('identifica pelo código do erro (via referência T_Erros)', () => {
        assert.equal(isRegistoErroKBPerdido({ tipoErro: '5' }), true);
    });

    test('identifica pelo texto livre do tipoErro, sem referência correspondente', () => {
        assert.equal(isRegistoErroKBPerdido({ tipoErro: 'Kanban Perdido' }), true);
    });

    test('não identifica outros tipos de erro', () => {
        assert.equal(isRegistoErroKBPerdido({ tipoErro: 'Caixa Danificada' }), false);
    });

    test('não lança excepção com registo vazio/undefined', () => {
        assert.equal(isRegistoErroKBPerdido({}), false);
        assert.equal(isRegistoErroKBPerdido(undefined), false);
    });
});

describe('dadosPainelKanban (painel e-ink, v4.25.0)', () => {
    // O resumo que vai para o impreskanban.painel.json: kanbans (soma de qtdKanbans), não registos.
    const { dadosPainelKanban } = carregarFuncoesPuras(['dadosPainelKanban']);
    const agora = new Date(2026, 9, 8, 10, 0);   // 8 out 2026 (quinta)
    const r = (data, qtdKanbans, tipoErro, servico) => ({ data, qtdKanbans, tipoErro, servico });
    const lista = [
        r('2026-10-08', 3, 'KB Perdido', 'UCIP'),
        r('2026-10-08', 2, 'KB Danificado', 'UCIP'),
        r('2026-10-02', 5, 'KB Perdido', 'Pediatria'),     // nos 7 dias (2 a 8)
        r('2026-10-01', 4, 'KB Perdido', 'Pediatria'),     // no mês, fora dos 7 dias
        r('2026-09-30', 7, 'Novo artigo', 'UCIP'),         // mês anterior, nos 14 dias
        r('2026-09-01', 9, 'KB Perdido', 'UCIP'),          // fora de tudo menos `ultimo`
        r('lixo', 100, 'X', 'Y'),                          // data inválida: ignorado
        r('2026-10-07', 'abc', 'KB Perdido', ''),          // quantidade inválida conta 1; serviço vazio
    ];
    const d = JSON.parse(JSON.stringify(dadosPainelKanban(lista, agora)));

    test('hoje, 7 dias e mês, em kanbans', () => {
        assert.equal(d.hoje, 5);
        assert.equal(d.semana, 5 + 5 + 1);
        assert.equal(d.mes, 5 + 5 + 4 + 1);
        assert.equal(d.registosMes, 5);
        assert.equal(d.ultimo, '2026-10-08');
    });
    test('14 dias, do mais antigo para hoje, com zeros nos dias sem registos', () => {
        assert.equal(d.porDia.length, 14);
        assert.deepEqual(d.porDia[0], { data: '2026-09-25', n: 0 });
        assert.deepEqual(d.porDia[13], { data: '2026-10-08', n: 5 });
        assert.equal(d.porDia.find(x => x.data === '2026-09-30').n, 7);
    });
    test('tipos de erro e serviços do mês, do maior para o menor', () => {
        assert.deepEqual(d.erros, [{ tipo: 'KB Perdido', n: 3 + 5 + 4 + 1 }, { tipo: 'KB Danificado', n: 2 }]);
        assert.deepEqual(d.servicos, [{ nome: 'Pediatria', n: 9 }, { nome: 'UCIP', n: 5 }, { nome: '(sem valor)', n: 1 }]);
    });
    test('comparações: ontem, semana anterior, mês anterior, registos e serviços de hoje', () => {
        assert.equal(d.ontem, 1);
        assert.equal(d.semanaAnterior, 7 + 4);      // 25 set a 1 out: 30 set (7) e 1 out (4)
        assert.equal(d.mesAnterior, 7 + 9);
        assert.equal(d.registosHoje, 2);
        assert.equal(d.servicosAtivosHoje, 1);
        assert.equal(d.diasSemRegisto, 0);
    });
    test('hoje por hora (08h–18h), dia da semana, artigos, origens e ID tags', () => {
        const l2 = [
            { data: '2026-10-08', qtdKanbans: 2, timestamp: new Date(2026, 9, 8, 9, 30).toISOString(), artigoDescricao: 'Fiambre', origem: 'Rutura', idTag: 'A1', servicoId: 1, servico: 'Talho' },
            { data: '2026-10-08', qtdKanbans: 1, timestamp: new Date(2026, 9, 8, 22, 0).toISOString(), artigoDescricao: 'Fiambre', origem: 'Pedido', idTag: ' ', servicoId: 2, servico: 'Padaria' },
            { data: '2026-10-01', qtdKanbans: 8, artigoDescricao: 'Salmão', origem: 'Rutura', idTag: '' },
        ];
        const v = JSON.parse(JSON.stringify(dadosPainelKanban(l2, agora)));
        assert.equal(v.porHora.length, 11);
        assert.deepEqual(v.porHora[1], { h: 9, n: 2 });
        assert.equal(v.porHora.reduce((t, x) => t + x.n, 0), 2);   // 22h fica fora da janela
        assert.equal(v.porDiaSemana.length, 7);
        assert.deepEqual(v.porDiaSemana[4], { d: 4, n: 1.4 });     // quintas: 8 out (3) e 1 out (8) = 11, a dividir por 8 semanas
        assert.deepEqual(v.artigos, [{ nome: 'Salmão', n: 8 }, { nome: 'Fiambre', n: 3 }]);
        assert.deepEqual(v.origens, [{ nome: 'Rutura', n: 10 }, { nome: 'Pedido', n: 1 }]);
        assert.equal(v.taxaIdTags, 0.333);
        assert.deepEqual(v.servicosHoje.map(x => x.nome).sort(), ['Padaria', 'Talho']);
    });
    test('mês e ano corrente: produção diária, origens e tipos de erro (v4.26.0)', () => {
        const l3 = [
            { data: '2026-10-08', qtdKanbans: 3, origem: 'Rutura', tipoErro: 'KB Perdido' },
            { data: '2026-10-31', qtdKanbans: 1, origem: 'Pedido', tipoErro: 'KB Perdido' },
            { data: '2026-03-15', qtdKanbans: 6, origem: 'Rutura', tipoErro: 'Novo artigo' },
            { data: '2025-12-31', qtdKanbans: 50, origem: 'Rutura', tipoErro: 'X' },
        ];
        const v = JSON.parse(JSON.stringify(dadosPainelKanban(l3, agora)));
        assert.equal(v.mesPorDia.length, 31);
        assert.deepEqual(v.mesPorDia[7], { data: '2026-10-08', n: 3 });
        assert.equal(v.mesPorDia.reduce((t, x) => t + x.n, 0), 4);
        assert.equal(v.ano, 10);
        assert.equal(v.anoPorDia.length, 365);
        assert.deepEqual(v.anoPorDia.find(x => x.data === '2026-03-15'), { data: '2026-03-15', n: 6 });
        assert.deepEqual(v.anoOrigens, [{ nome: 'Rutura', n: 9 }, { nome: 'Pedido', n: 1 }]);
        assert.deepEqual(v.anoErros, [{ tipo: 'Novo artigo', n: 6 }, { tipo: 'KB Perdido', n: 4 }]);
    });
    test('sem registos: zeros, último a null', () => {
        const v = JSON.parse(JSON.stringify(dadosPainelKanban([], agora)));
        assert.equal(v.hoje + v.semana + v.mes + v.registosMes, 0);
        assert.equal(v.ultimo, null);
        assert.equal(v.porDia.length, 14);
        assert.deepEqual([v.erros, v.servicos, v.artigos, v.origens], [[], [], [], []]);
        assert.equal(v.taxaIdTags, null);
        assert.equal(v.diasSemRegisto, null);
    });
});
