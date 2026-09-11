#!/usr/bin/env node
// Verifica que a versão da app está sincronizada nos sítios que não podem
// ser derivados de version.js automaticamente (são prosa/comentários, não
// código): o cabeçalho do bloco de estilos e a entrada mais recente do
// changelog, ambos em index.html. version.js é a fonte única para tudo o
// resto (título, #appVersionDisplay, sw.js) — ver v4.15.1.
//
// Sai com código 1 e explica o que diverge se alguma verificação falhar.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function lerFicheiro(nome) {
    return fs.readFileSync(path.join(ROOT, nome), 'utf8');
}

function extrair(conteudo, regex, descricao, ficheiro) {
    const match = conteudo.match(regex);
    if (!match) {
        throw new Error(`Não encontrei ${descricao} em ${ficheiro} (regex: ${regex})`);
    }
    return match[1];
}

function main() {
    const versionJs = lerFicheiro('version.js');
    const fonte = extrair(versionJs, /APP_VERSION\s*=\s*'([\d.]+)'/, 'APP_VERSION', 'version.js');

    const indexHtml = lerFicheiro('index.html');
    const cabecalhoCSS = extrair(
        indexHtml,
        /KANBAN KPI ANALYZER v([\d.]+)/,
        'a versão no cabeçalho do bloco de estilos',
        'index.html'
    );
    const changelogTopo = extrair(
        indexHtml,
        /VERS[ÃA]O ([\d.]+) -/,
        'a versão da entrada mais recente do changelog',
        'index.html'
    );

    const divergencias = [];
    if (cabecalhoCSS !== fonte) {
        divergencias.push(`- cabeçalho CSS "KANBAN KPI ANALYZER v${cabecalhoCSS}" != version.js (${fonte})`);
    }
    if (changelogTopo !== fonte) {
        divergencias.push(`- topo do changelog "VERSÃO ${changelogTopo}" != version.js (${fonte})`);
    }

    if (divergencias.length > 0) {
        console.error(`❌ Versão dessincronizada (fonte única: version.js = ${fonte}):\n${divergencias.join('\n')}\n\nAtualize os sítios acima para ${fonte} (ou bump version.js).`);
        process.exit(1);
    }

    console.log(`✅ Versão sincronizada em todos os sítios verificados (${fonte})`);
}

main();
