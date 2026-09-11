#!/usr/bin/env node
// Valida a sintaxe do JavaScript inline de index.html com `node --check`
// (o próprio parser do V8/Node, não uma reimplementação) — sem isto, um
// erro de sintaxe introduzido no <script> só era descoberto ao abrir a app
// no browser. Não executa o código (document/window/localStorage não
// existem aqui), só confirma que é sintaticamente válido.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { lerIndexHtml, extrairScriptsInline } = require('./lib/extract-scripts.js');

function main() {
    const html = lerIndexHtml();
    const scripts = extrairScriptsInline(html);

    if (scripts.length === 0) {
        console.error('❌ Nenhum <script> inline encontrado em index.html — extração falhou?');
        process.exit(1);
    }

    let falhou = false;
    scripts.forEach((codigo, i) => {
        const tmpFile = path.join(os.tmpdir(), `kanban-inline-script-${i}.js`);
        fs.writeFileSync(tmpFile, codigo);
        try {
            execFileSync(process.execPath, ['--check', tmpFile], { stdio: 'pipe' });
            console.log(`✅ <script> inline #${i + 1}/${scripts.length}: sintaxe válida`);
        } catch (err) {
            falhou = true;
            console.error(`❌ <script> inline #${i + 1}/${scripts.length}: erro de sintaxe`);
            console.error(err.stderr ? err.stderr.toString() : err.message);
        } finally {
            fs.unlinkSync(tmpFile);
        }
    });

    if (falhou) process.exit(1);
    console.log(`✅ Todos os ${scripts.length} blocos <script> inline de index.html têm sintaxe válida`);
}

main();
