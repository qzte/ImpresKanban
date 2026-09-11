// Utilitários para extrair JavaScript do index.html (que não tem build step
// nem package.json — é HTML+JS num único ficheiro). Usado por:
//   - scripts/check-js-syntax.js (node --check ao JS inline)
//   - test/pure-functions.test.js (carrega funções puras específicas para testar)

const fs = require('fs');
const path = require('path');

const INDEX_HTML = path.join(__dirname, '..', '..', 'index.html');

function lerIndexHtml() {
    return fs.readFileSync(INDEX_HTML, 'utf8');
}

/**
 * Devolve o conteúdo de cada <script>...</script> SEM atributo src (scripts
 * inline) — os de CDN (com src="https://...") não fazem sentido verificar
 * aqui, e não são JavaScript nosso.
 */
function extrairScriptsInline(html) {
    const scripts = [];
    // Duas defesas contra texto de prosa que pareça uma tag (já aconteceu
    // duas vezes em comentários do changelog — v4.15.3): 1) só considerar
    // "<script" no início de linha (só espaços antes), que é como todas as
    // tags reais neste ficheiro estão formatadas; 2) atributos exigem
    // ="valor", nunca um atributo "nu" como `<script src>`.
    const regex = /^[ \t]*<script((?:\s+[a-zA-Z-]+=(?:"[^"]*"|'[^']*'))*)\s*>([\s\S]*?)<\/script>/gm;
    let match;
    while ((match = regex.exec(html)) !== null) {
        const atributos = match[1] || '';
        if (/\bsrc\s*=/.test(atributos)) continue; // externo (CDN ou version.js)
        scripts.push(match[2]);
    }
    return scripts;
}

/**
 * Extrai o código-fonte de uma função "function nome(...) { ... }" por
 * contagem de chavetas equilibrada — regex simples não chega porque o corpo
 * tem blocos aninhados (switch/case, ifs). Trata strings ('...', "...",
 * `...`) e comentários (// e /* *\/) como opacos, para que chavetas lá
 * dentro não desequilibrem a contagem.
 *
 * Não trata literais de regex (/.../) como opacos — nenhuma das funções
 * puras extraídas atualmente tem chavetas dentro de uma regex, por isso
 * não é necessário para este uso; adicionar suporte se isso mudar.
 */
function extrairFuncao(html, nome) {
    const marcador = `function ${nome}(`;
    const inicio = html.indexOf(marcador);
    if (inicio === -1) {
        throw new Error(`Função ${nome}() não encontrada em index.html`);
    }
    if (html.indexOf(marcador, inicio + 1) !== -1) {
        throw new Error(`Função ${nome}() encontrada mais do que uma vez em index.html`);
    }

    const chavetaAbertura = html.indexOf('{', inicio);
    if (chavetaAbertura === -1) {
        throw new Error(`Corpo de ${nome}() não encontrado`);
    }

    let profundidade = 1;
    let i = chavetaAbertura + 1;
    while (profundidade > 0) {
        if (i >= html.length) {
            throw new Error(`Chaveta de fecho de ${nome}() não encontrada (ficheiro truncado?)`);
        }
        const c = html[i];

        if (c === '"' || c === "'" || c === '`') {
            i = pularString(html, i, c);
        } else if (c === '/' && html[i + 1] === '/') {
            const fimLinha = html.indexOf('\n', i);
            i = fimLinha === -1 ? html.length : fimLinha;
        } else if (c === '/' && html[i + 1] === '*') {
            const fimComentario = html.indexOf('*/', i + 2);
            if (fimComentario === -1) {
                throw new Error(`Comentário de bloco sem fecho dentro de ${nome}()`);
            }
            i = fimComentario + 1;
        } else if (c === '{') {
            profundidade++;
        } else if (c === '}') {
            profundidade--;
        }
        i++;
    }

    return html.slice(inicio, i);
}

// Devolve o índice do carácter delimitador de fecho (aspa/crase), tratando
// barras invertidas de escape.
function pularString(html, indiceAbertura, delimitador) {
    let i = indiceAbertura + 1;
    while (i < html.length) {
        if (html[i] === '\\') {
            i += 2;
            continue;
        }
        if (html[i] === delimitador) {
            return i;
        }
        i++;
    }
    throw new Error('String/template literal sem fecho');
}

/**
 * Carrega um conjunto de funções puras (sem DOM) do index.html num
 * sandbox Node isolado (via vm), para poderem ser testadas diretamente.
 * `contextoExtra` permite expor variáveis globais adicionais que as
 * funções leem (ex.: `registos` para validarDuplicados).
 */
function carregarFuncoesPuras(nomes, contextoExtra = {}) {
    const vm = require('vm');
    const html = lerIndexHtml();
    const codigo = nomes.map(nome => extrairFuncao(html, nome)).join('\n\n');

    const sandbox = { console, ...contextoExtra };
    vm.createContext(sandbox);
    vm.runInContext(codigo, sandbox, { filename: 'index.html (funções extraídas)' });

    return sandbox;
}

module.exports = { lerIndexHtml, extrairScriptsInline, extrairFuncao, carregarFuncoesPuras, INDEX_HTML };
