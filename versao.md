# 📋 Histórico de Versões — Kanban KPI Analyzer

> Registo completo de todas as alterações, correções e melhorias da aplicação.

---

## v4.21.0 — 25 Set 2026

### 🛡️ Wrapper de localStorage

Várias funções chamavam `localStorage.getItem`/`setItem`/`removeItem` diretamente, sem `try/catch`, a assumir que a operação nunca falhava. Além da quota esgotada (já tratada desde a v4.11.2), `localStorage` também pode lançar em modo privado nalguns browsers, com storage bloqueado por política do dispositivo, ou num iframe com acesso restrito — nesses casos uma exceção não apanhada a meio do arranque (`DOMContentLoaded`) ou de `atualizarInterface()` partia a app inteira, mesmo para uma leitura de diagnóstico sem importância (ex.: `atualizarInfoBackup()`).

- **Novo:** `storageGet`/`storageSet`/`storageRemove`/`storageGetJSON`/`storageSetJSON` — wrapper que nunca lança; devolve um valor neutro (`null`/`false`) e regista um aviso na consola. Substitui as ~15 chamadas diretas a `localStorage` espalhadas por `mostrarCitacao`, `verificarBackupSemanal`, `criarObjetoBackup`, `atualizarIndicadorTabGestao`, `atualizarInfoBackup`, `limparReferencia`, `salvarDados`, `carregarDados`, `salvarReferencias`, `carregarReferencias`, `tentarRestaurarDeBackupAutomatico` e `limparTodosDados`
- **Corrigido:** `tentarRestaurarDeBackupAutomatico()` lia o backup legado sem `try/catch` — se essa leitura falhasse, a exceção escapava ao próprio `catch` de `carregarDados()` que a chama, e partia o arranque da app exatamente no caminho de recuperação de dados corrompidos
- **Corrigido:** em `salvarDados()`, uma falha ao gravar a chave de diagnóstico `_version` (não lida em lado nenhum) era reportada ao utilizador como se os registos não tivessem sido gravados, mesmo quando a gravação principal tinha tido sucesso — passa a ser melhor esforço, sem afetar o resultado
- Testado com `localStorage` completamente bloqueado (todas as chamadas a lançar `SecurityError`): antes desta alteração a app não chegava a arrancar; agora arranca normalmente, só com avisos na consola

---

## v4.20.0 — 25 Set 2026

### 🔒 Content-Security-Policy

Segunda camada de defesa além do `escapeHTML()` já aplicado em todas as renderizações de tabelas: se algum escapar (bug novo, backup JSON manipulado), o CSP ainda impede a app de carregar script de um domínio desconhecido ou enviar dados para fora.

- **Novo:** `<meta http-equiv="Content-Security-Policy">` em `index.html`. `script-src`/`style-src` só permitem `'self'`, `cdnjs.cloudflare.com`/`fonts.googleapis.com` (os mesmos domínios que `sw.js` já trata como confiáveis para pré-cache) e `'unsafe-inline'` — necessário porque a app tem ~90 `onclick=""` e ~480 `style=""` inline, arquitetura pré-existente sem build step; removê-los é um refactor à parte. `connect-src`, `object-src`, `base-uri` e `form-action` ficam nas restrições mais apertadas (a app não usa `fetch`/XHR, é 100% offline)
- `frame-ancestors` (proteção contra clickjacking) não tem efeito num `<meta>` — exige cabeçalho HTTP do servidor que aloja o ficheiro, fora do controlo desta app
- **Testes:** novo `e2e/csp.e2e.js` corre Importar Referências, Exportar Dados e Relatórios PDF com o `xlsx.js`/`jsPDF`/`autotable` reais da CDN (bytes idênticos, verificados por hash — ver `e2e/fixtures/README.md`) sob esta política, confirmando que nenhuma das bibliotecas precisa de `'unsafe-eval'`

---

## v4.19.0 — 25 Set 2026

### 📋 Histórico paginado

O Histórico desenhava **todas** as linhas filtradas de uma vez: cada linha com `innerHTML` e dois listeners. Com meses de registos, e com a pesquisa a correr enquanto se escreve (v4.17.0), a interface ficava lenta.

- **Novo:** a tabela mostra os **100** registos mais recentes. O botão **"⬇️ Mostrar mais"** acrescenta os 100 seguintes sem redesenhar os anteriores, e indica "A mostrar X de Y registos". As estatísticas do topo (registos, kanbans, serviços, artigos) continuam a contar **todos** os registos filtrados
- Filtros novos voltam à primeira página. Com os mesmos filtros (por exemplo, ao reabrir a tab depois de editar um registo), mantêm-se as páginas já abertas
- **Corrigido:** ao eliminar um registo no Histórico, a linha continuava visível na tabela até se reabrir a tab. Agora a tabela é atualizada logo
- **Robustez:** a ordenação por data já não falha se algum registo não tiver data

---

## v4.18.0 — 25 Set 2026

### 💾 Armazenamento mais leve e seguro + pesquisas mais rápidas

Primeiro lote da revisão de custo/benefício: menos risco de esgotar a quota do `localStorage` e de perder dados, sem alterações à interface.

- **Removido o "backup automático" no `localStorage`:** a cada 5 minutos, ao mudar de separador e ao fechar a janela, a app gravava uma cópia completa dos registos e referências (`kanban_backup`) no próprio `localStorage`. Isso gastava cerca de **metade da quota** (~5MB) só com a cópia. Também não protegia do cenário real de perda: quando o browser apaga os dados do site, apaga a cópia junto. Cada alteração já é gravada no momento por `salvarDados()`/`salvarReferencias()`, com reversão em caso de falha. A cópia antiga é apagada assim que os dados principais carregam sem erro; se estiverem corrompidos, continua a ser oferecida para recuperação, como antes
- **Novo:** `navigator.storage.persist()` no arranque — pede ao browser para não apagar os dados da app quando falta espaço em disco (numa PWA instalada costuma ser aceite sem perguntar)
- **Alterado:** o indicador da tab 💾 Gestão dos Dados e o "Último backup" passam a refletir o último **backup JSON exportado para ficheiro** (manual ou semanal). Antes estavam sempre verdes por causa da cópia interna, mesmo sem nenhum backup real. O indicador fica amarelo quando o último backup em ficheiro tem mais de 7 dias, o mesmo ritmo do lembrete semanal
- **Performance:** `encontrarServico`, `encontrarArtigo` e `encontrarErro` passam a usar um índice (`Map`) em cache em vez de percorrer a tabela com `.find()`. O Histórico chama `encontrarErro` por linha e a T_Artigo pode ter milhares de entradas. Novos testes garantem que o índice acompanha a substituição das tabelas e mantém a semântica de "primeira ocorrência"
- **Limpeza:** o histórico de versões duplicado dentro do `index.html` (≈400 linhas de comentários, ~24KB enviados em cada visita) foi removido — a fonte é este ficheiro. O CI (`check-version-sync.js`) passa a validar a versão do topo de `versao.md`
- **Limpeza:** os ~110 `console.log` de diagnóstico só aparecem com o modo debug ligado (`localStorage.setItem('kanban_debug', '1')` e recarregar). `console.warn`/`console.error` mantêm-se sempre ativos

---

## v4.17.0 — 25 Set 2026

### ⚡ Revisão de código: performance, testes e robustez

Resultado de uma revisão de código orientada a custo/benefício (segurança, arquitetura e performance). Sem alterações de comportamento visíveis para o utilizador, exceto onde indicado.

- **Performance:** `xlsx.js`, `jsPDF` e `jspdf-autotable` deixam de ser carregados de forma estática no `<head>` — são bibliotecas pesadas (xlsx.js sozinha tem mais de 800KB) usadas apenas nas tabs de Importar/Exportar e Relatórios, mas até agora penalizavam o arranque de **todas** as visitas. Passam a ser injetadas dinamicamente (`carregarScriptExterno()`) só quando são efetivamente necessárias. O Service Worker continua a pré-cachear estes URLs (`sw.js`), por isso o carregamento diferido continua a funcionar offline após a primeira visita
- **UX:** pesquisa em tempo real (com debounce de 250ms) nos campos de texto "Serviço" e "Artigo" do filtro do Histórico — já não é preciso clicar em "Pesquisar" a cada alteração
- **Testes:** novos testes unitários para `encontrarServico`, `encontrarArtigo`, `encontrarErro`, `mergeReferencia` e `isRegistoErroKBPerdido` — funções de lógica de negócio até agora sem cobertura (ver `test/pure-functions.test.js`)
- **Robustez:** `carregarReferencias()` passa a validar que cada tabela lida do `localStorage` é de facto um array (protege contra dados corrompidos por uma gravação interrompida por quota excedida), tal como `carregarDados()` já fazia
- **Robustez:** limite de 20MB na importação de ficheiros Excel (Registos e Referências), para evitar consumo excessivo de memória com ficheiros corrompidos ou demasiado grandes
- **Acessibilidade:** `aria-label` nos botões de ação que só tinham um emoji e nenhum texto ou `title` (remover linha em Batch, eliminar registo no Histórico, fechar modal de detalhe)

---

## v4.16.1 — 18 Set 2026

### 🔄 Filtro Tipo de Erro no Histórico

No Histórico de Registos, o filtro por **"ID Tag"** obrigava a saber de memória o identificador exato da tag para encontrar os registos de um determinado tipo de erro — não havia forma de filtrar diretamente por "Tipo de Erro".

- **Alterado:** o filtro "ID Tag" foi substituído por **"Tipo de Erro"**
- O campo passou de texto livre a **dropdown** (`<select>`), populado a partir de `T_Erros` — mesma abordagem já usada no filtro "Origem"
- O filtro compara pelo código exato do erro selecionado, em vez de correspondência parcial de texto

---

## v4.16.0 — 11 Set 2026

### ✨ Feature: Aviso de nova versão na PWA

Uma página já aberta ficava num estado híbrido depois de uma atualização: o `sw.js` faz `skipWaiting()` no install e `clients.claim()` no activate, por isso o Service Worker novo assumia logo o controlo — mas o browser continuava a mostrar o HTML antigo, já carregado. Nada na interface denunciava isso; a atualização só se tornava visível se o operador recarregasse por acaso.

- **Novo:** listener de `controllerchange` que mostra o aviso fixo **"🔄 Nova versão disponível — recarregar para atualizar"**, com botão **Recarregar** e botão para dispensar
- O aviso não aparece na primeira instalação de todas (aí o `clients.claim()` dispara o mesmo evento, mas o HTML em memória veio da rede e já é o mais recente): guardado por `navigator.serviceWorker.controller`, lido antes do registo
- Dispensar apenas esconde o aviso — a app continua a correr o HTML antigo até ser recarregada

---

## v4.15.0 — 08 Set 2026

### ✨ Feature: Concatenar backups de dois operadores

A importação de backup JSON (`importarBackup()`) substituía sempre por completo os dados atuais — não havia forma de juntar o backup de um operador ao de outro sem perder um dos dois conjuntos de registos.

- **Novo:** ao importar um backup JSON, é agora perguntado se pretende **Concatenar** (juntar aos dados atuais) ou **Substituir** (comportamento anterior)
- No modo Concatenar, os `registos` do backup são juntados aos atuais sem duplicar por `uuid`, e as tabelas de referência (`tArtigo`, `tServicos`, `tUtilizadores`, `tErros`, `tOrigem`) são unidas por chave (`CODIGO`, `ID_SERVICO`, `UUID_UTILIZADOR`, `CODIGO_ERRO`, `ID_ORIGEM`), mantendo a entrada atual em caso de conflito

---

## v4.14.0 — 18 Ago 2026

### ✨ Feature: Campo Observação no registo em Batch (Múltiplos Artigos)

No separador **Batch → Múltiplos Artigos**, cada linha da secção "Artigos a Adicionar" gravava sempre o registo com o campo Observações preenchido automaticamente com o texto fixo `Batch registo N` — não havia forma de anotar algo específico sobre um artigo da lista, ao contrário do formulário individual (Identificação), que já tem um campo de Observações livre.

- **Novo:** campo de texto **"Observação"** (opcional) em cada linha de artigo, a seguir a "Qtd Kanbans"
- O texto introduzido em cada linha passa a ser gravado no campo `obs` do respetivo registo, substituindo o rótulo automático anterior; se a linha ficar em branco, o registo fica sem observação (tal como um registo individual sem notas)

---

## v4.13.0 — 17 Ago 2026

### ✨ Feature: ID Tag obrigatório quando o erro é "ID Tag ilegível ou em falta"

Ao selecionar o Tipo de Erro **"ID Tag ilegível ou em falta"**, era possível gravar o registo sem indicar o número da tag RFID — a informação que justamente identificaria a tag em causa ficava em falta no próprio registo que reporta esse problema.

- **Novo:** o campo **"ID Tag"** passa a ser obrigatório sempre que o Tipo de Erro selecionado corresponde a "ID Tag ilegível ou em falta", nos 3 formulários de registo — Identificação, Batch por Artigos (uma tag por linha) e Batch por Serviços
- O campo mostra o asterisco de obrigatório e uma nota explicativa apenas quando aplicável; nos restantes tipos de erro o "ID Tag" mantém-se opcional
- Segue o mesmo padrão já usado para o campo "Ultimo Estado do RFID" (obrigatório quando o erro é "KB Perdido"): comparação do texto do Tipo de Erro normalizado (sem acentos, minúsculas) contra a descrição de `T_Erros`
- Validação aplicada tanto no envio do formulário como ao editar um registo existente

---

## v4.12.0 — 14 Ago 2026

### ✨ Feature: Exportar para Excel no popup de detalhe

O popup de detalhe que abre ao clicar num gráfico (ex.: barras de **Tipo de Erro** no dashboard de Qualidade, como "Erro — Caixa Danificada") mostrava a lista de registos filtrados mas não permitia exportá-la — para analisar um tipo de erro específico fora da app, era preciso reconstruir o filtro manualmente no separador Registos.

- **Novo:** botão **"📤 Exportar Excel"** no cabeçalho do popup de detalhe (`#modalDetalheGrafico`), junto ao botão de fechar
- Exporta exatamente os registos atualmente mostrados no popup — sejam de um tipo de erro, de um dia, de uma hora ou de um mês, consoante o gráfico de origem
- Inclui a coluna **"Tipo Erro Descrição"** (via `encontrarErro()`), para identificar rapidamente o tipo de erro específico sem cruzar com `T_Erros`
- Nome do ficheiro inclui o título do popup (ex.: `Kanban_Detalhe_Erro_—_Caixa_Danificada_20260814_1530.xlsx`)
- Reutiliza `verificarBibliotecaExcel()` e `downloadExcelTradicional()`, já usadas no export de Registos — mesmo comportamento de fallback quando `showSaveFilePicker` não está disponível

---

## v4.11.5 — 13 Ago 2026

### 🐛 Fix: Descrição do Tipo de Erro em falta no Excel exportado

O ficheiro gerado por **"Exportar para Excel"** (separador Registos) só incluía o **código** do Tipo de Erro (ex.: `5`), não a sua descrição (ex.: `KB Perdido`) — obrigando a cruzar manualmente com `T_Erros` para perceber o que cada registo representava.

- **Fix:** nova coluna **"Tipo Erro Descrição"** no export, a seguir a "Tipo Erro", resolvida via `encontrarErro(r.tipoErro)` (mesma função já usada nos dashboards e relatórios PDF)

---

## v4.11.4 — 07 Ago 2026

### 📱 Fix: layout responsivo partido em telemóvel

A app estava efetivamente inutilizável em ecrãs de telemóvel. Causa: a barra de separadores principais (**Registos / Dashboards / Relatorios / Gestão dos Dados**) e as sub-barras de separadores (**Identificação / Batch / Histórico**, **Operacional / Gestão / Qualidade**) eram uma linha `flex` sem `flex-wrap` e sem scroll horizontal. Em ecrãs estreitos, a linha de botões ficava mais larga do que o ecrã e, como nada limitava o overflow horizontal, o browser expandia o **viewport de layout** inteiro para caber a linha — a página inteira passava a renderizar a uma escala reduzida (efeito de "zoom out"), tornando todo o resto da app ilegível e difícil de tocar.

- **Fix:** as 3 barras de separadores passam a usar `flex-wrap: wrap`, pelo que quebram para várias linhas em vez de forçar overflow da página
- **Fix:** `html`/`body` passam a ter `overflow-x: hidden` como rede de segurança — nenhum elemento futuro poderá voltar a alargar o viewport da página
- **Fix:** badge de versão do cabeçalho (`header .version`) estava `position: absolute`, ancorada ao canto inferior direito do cabeçalho; quando o subtítulo quebrava para 2/3 linhas em ecrãs estreitos, a badge ficava sobreposta ao texto — passa a `position: static` abaixo dos 768px
- Separadores (`.main-tab`, `.dashboard-tab`) com padding e tamanho de letra reduzidos abaixo dos 768px, para um aspeto mais compacto em telemóvel
- Verificado com Chromium em emulação mobile (375×667): sem overflow horizontal em nenhum dos separadores principais, `window.innerWidth` mantém-se em 375px em todos os ecrãs

> ℹ️ O sintoma (app "não funcional" em telemóvel) não era um crash — era o viewport de layout a expandir-se para acomodar uma única linha de botões demasiado larga, o que reduzia a escala de toda a interface.

---

## v4.11.3 — 03 Ago 2026

### 🎨 Identidade visual: ícone Kkpi
- Ícones da app substituídos pelo logótipo **Kkpi** (fundo vermelho, lettering branco), nas 4 variantes declaradas no `manifest.json`: `192`/`512` normais e `192`/`512` *maskable*
- As variantes *maskable* têm o fundo a sangrar e o lettering dentro da zona segura (80% central), para não serem cortadas pelas máscaras do Android
- **Ícone ligado também como `favicon` e `apple-touch-icon`** — a app não tinha nenhum e o pedido a `/favicon.ico` devolvia 404
- O bump de versão renova o `CACHE_NAME` do Service Worker, para que as PWA já instaladas recebam os ícones novos na próxima visita online

> ℹ️ `icon-192.png` e `icon-512.png` são os ficheiros originais do logótipo. As variantes *maskable* são derivadas deles por recorte do lettering e reposicionamento na zona segura — mesmos letterforms, mesmo vermelho (`#FF0000`).

---

## v4.11.2 — 03 Ago 2026

### 🚑 Revisão da app: PWA reparada + integridade de dados

**PWA estava efetivamente partida.** O `APP_SHELL` do Service Worker apontava para o ficheiro versionado (`kanban-kpi-analyzer-v4_11_1.html`) e para `./icons/icon-192.png` — pasta que não existe no repositório. Como `cache.addAll()` rejeita se **um** dos recursos falhar, a instalação do SW abortava sempre: a app nunca funcionou offline nem era realmente instalável, apesar de o registo aparecer como bem-sucedido na consola.

- **Fix:** `APP_SHELL` passa a `./index.html` + ícones da raiz (`./icon-192.png`, `./icon-512.png`)
- **Fix:** `manifest.json` — caminhos dos ícones corrigidos e adicionadas as variantes `maskable` (os ficheiros já existiam no repositório mas não estavam declarados)
- **SW: fallback de navegação offline** e **cache restrito** a same-origin + CDNs conhecidas — anunciados na v4.11.0, mas ausentes do `sw.js`; agora implementados
- ✅ Verificado em Chromium: com o servidor desligado, `index.html` e rotas desconhecidas são servidos a partir do cache

### 🛡️ Integridade dos dados
- **Fix:** era possível gravar um registo com um serviço ou artigo que não existe nas referências. O campo **Armazém** é `readonly` e, por isso, está isento da validação nativa do browser — o registo era aceite com armazém, descrição e local vazios, e depois aparecia em branco nos dashboards e nos relatórios PDF. A submissão passa a exigir serviço e artigo válidos
- Os valores gravados passam a vir das referências (forma canónica), e não do que ficou no ecrã

### 🐛 Correções
- **Referências deixam de falhar por tipo:** `ID_SERVICO` e `CODIGO_ERRO` numéricos vindos do Excel eram comparados com `===` contra strings — o serviço aparecia como "não encontrado" e o dashboard mostrava o código do erro em vez da descrição. Novas funções `encontrarServico()`, `encontrarArtigo()` e `encontrarErro()` comparam como texto (7 pesquisas duplicadas de erro substituídas por uma)
- **Código de artigo sem zeros à esquerda** (`12345` vs `0000012345`) passa a ser reconhecido e gravado na forma canónica
- **Gravar uma edição** já não mostra "Edição cancelada" por cima da confirmação de sucesso
- **`ESTADO_CODIGO`** tolerante ao tipo e à caixa da célula, à semelhança do que a v4.9.9 fez nas restantes tabelas
- **"Limpar referências"** passa a limpar também utilizadores e erros — ficavam em memória e no `localStorage`, com os dropdowns preenchidos
- **`escapeHTML(undefined)`** devolve `''` em vez de escrever literalmente "undefined" nas células de registos antigos

### 🔒 Segurança e robustez
- `limparTodosDados()` deixa de usar `localStorage.clear()`, que apagava também dados de outras páginas alojadas na mesma origem; remove apenas as chaves da aplicação (`CHAVES_STORAGE_APP`)
- `gerarUUID()` usa `crypto.randomUUID()` quando disponível
- Mensagens acionáveis quando o **espaço de armazenamento esgota** (o registo não é gravado — o utilizador tem de saber) e quando a **biblioteca de Excel da CDN** não está disponível

### 🧹 Limpeza
- `atualizarTabela()` removida — operava sobre `#dataTable`, elemento removido na v3.6.1; era código morto com saída imediata (−78 linhas)

---

## v4.11.1 — 19 Jul 2026

### 🔒 Correções de segurança (auditoria)
- **SRI (`sha384`) + `crossorigin="anonymous"`** nos 3 scripts CDN (xlsx 0.18.5, jsPDF 2.5.1, autotable 3.5.31)
- `mostrarAlerta()` e `mostrarAlertaReferencia()` escapam a mensagem com `escapeHTML()` antes do `innerHTML` (`<br>` e `\n` intencionais preservados)
- `escapeHTML()` aplicado a `origem.Nome` nos botões de filtro de origem e à lista de origens do `infoText`

---

## v4.11.0 — 18 Jul 2026

### 📌 PWA estável + Service Worker robusto
- **App servida como `index.html` estável** — `start_url` (manifest) e `APP_SHELL` (sw.js) deixam de depender do nome de ficheiro versionado; bumps futuros já não partem PWAs instaladas nos dispositivos da equipa
- **SW: fallback de navegação offline** — pedidos de navegação sem correspondência em cache respondem com o app shell (`index.html`)
- **SW: cache restrito** a same-origin + CDNs conhecidas (`cdnjs`, Google Fonts) — evita crescimento ilimitado do cache
- **Fix:** `console.log` de arranque usa `APP_VERSION` dinamicamente — elimina a 6ª localização de versão que ficava desatualizada (mostrava "v4.9")

---

## v4.10.0 — 11 Jul 2026

### 📱 Progressive Web App (PWA)
- App instalável: `manifest.json` + `sw.js` (Service Worker) adicionados à raiz do repositório
- Funciona 100% offline após a primeira visita online — cache-first para o HTML e bibliotecas CDN (xlsx.js, jsPDF, jsPDF-AutoTable, Google Fonts), permitindo exportar Excel/PDF sem internet
- `theme-color` (#0066CC) e ícones 192/512 para ecrã inicial em Android/iOS/Desktop
- ⚠️ Requer HTTPS ou localhost — não funciona em `file://` (limitação do Service Worker)

---

## v4.9.13 — 11 Jul 2026

### 📅 Limite de 40 dias no gráfico Atividade por Dia
- Gráfico "Atividade por Dia" (dashboard Operacional) mostra apenas os últimos 40 dias com registos — evita barras demasiado finas e ilegíveis em períodos longos

---

## v4.9.12 — 02 Jul 2026

### 🧹 Refactor: filtros rápidos unificados
- `filtroRapido()`/`filtroRapidoGestao()`/`filtroRapidoQualidade()` tinham a lógica de cálculo de datas triplicada — extraída para `calcularIntervaloDataRapido(tipo)`; as 3 funções passam a wrappers finos. Sem alteração de comportamento. −55 linhas

---

## v4.9.11 — 02 Jul 2026

### 🎨 Cores de origem dinâmicas
- **Fix:** `CORES_ORIGEM` tinha roxo duplicado (índices 0 e 4) — 5ª origem substituída por rosa (#EC4899)
- **Fix:** badges de origem e "Distribuição por Origem" só conheciam Armazém/Externo A/Externo B hardcoded — agora usam `obterCorOrigem()` derivada da posição em `tOrigem`
- 🧹 `getBadgeClass()` removida (substituída por `obterCorOrigem()` + `estiloBadgeOrigem()`)

---

## v4.9.10 — 02 Jul 2026

### 🐛 Consistência de filtros e duplicados
- **Fix:** Dashboard Qualidade com 0 origens selecionadas mostrava TODOS os registos; Gestão mostrava 0 — agora consistente: 0 origens = 0 registos em ambos
- **Fix:** `validarDuplicados()` não considerava origem nem tipoErro — falsos avisos em registos legítimos
- 🧹 Removida `restaurarBackup()` — código morto (substituída por `importarBackup()` desde v4.9.6)

---

## v4.9.9 — 02 Jul 2026

### 🔒 Fixes de segurança e robustez
- **Fix XSS:** `escapeHTML()` em Top Serviços, Top Artigos, Distribuição por Origem, Análise de Erros e KB Perdido/RFID
- **Fix:** onclick dos gráficos de erro deixou de interpolar texto livre no atributo — lookup por índice
- **Fix:** filtros `*_ATIVO` comparavam com `=== true`; células Excel em texto/número carregavam 0 linhas — nova `isValorAtivo()` tolerante

---

## v4.9.8 — 11 Jun 2026

### 📅 Backup semanal com modal bloqueante
- Modal de backup semanal bloqueante (overlay semi-transparente); só fecha após backup concluído
- Dia configurável via constante `BACKUP_DIA_SEMANA`; integrado com `exportarBackup()` existente
- **Fix:** utilizador "undefined" — campo email removido (não existe na nova estrutura `T_Utilizadores`)

---

## v4.9 — 10 Mai 2026

### 🧹 Limpeza de Código (Code Review)
- Removidas **~860 linhas de código morto** — 8 funções órfãs de versões anteriores que já não eram chamadas por nenhum elemento HTML: `exportarExcelCompleto`, `limparDados`, `importarExcel`, `exportarExcel`, `abrirHistorico`, `fecharHistorico`, `filtrarHistorico`, `atualizarTabelaHistorico`, `exportarHistorico`
- **Fix:** `htmlTags` declarada com `const` — era variável global implícita (potencial erro em strict mode)
- **Fix:** `mudarOpTab` duplicada removida do `<head>`; substituída por stub mínimo; implementação completa mantida no body script
- **Fix:** 10 comentários HTML duplicados (`<!-- Passo 1: Formulário... -->`) removidos do bloco `opBatch` — resquícios de refactoring anterior
- **Fix:** Discrepância `v4.8.1` no changelog interno corrigida — changelogs consolidados e consistentes
- **Fix:** Atribuições redundantes `window.mudarTabPrincipal = mudarTabPrincipal` e `window.mudarDashboard = mudarDashboard` removidas
- Resultado: **8.805 → 7.886 linhas** | **429KB → 388KB** (−10%)

---

## v4.8 — 09 Mai 2026

### 🔄 Origens Dinâmicas + Backup Unificado
- **Origens dinâmicas:** dropdown de Origem no formulário, batch e histórico carregado diretamente de `tOrigem` — sem hardcoding de "Armazém/Externo A/Externo B"
- **Backup unificado:** função `criarObjetoBackup()` partilhada entre backup automático e exportação manual — garante consistência de esquema entre os dois fluxos
- **Eliminação consistente:** aceita `uuid` e `id` legado via comparação `String(r.uuid || '') !== id` — retrocompatível com registos antigos
- **Filtros de origem dinâmicos:** botões nos dashboards Gestão e Qualidade renderizados automaticamente de `tOrigem`; contadores e toggles funcionam com qualquer número de origens
- 🔒 **Segurança XSS:** `escapeHTML()` aplicado em todas as renderizações de tabelas (`atualizarTabela`, `aplicarFiltrosHistorico`); UUIDs escapados nos atributos `onclick`

---

## v4.7.8 — Mai 2026

### 🗑️ Remoção "Anomalias no Período" + Novos Stat Cards
- Removida a funcionalidade "Anomalias no Período" do Dashboard de Qualidade (não alinhada com a lógica operacional real)
- Substituída por dois stat cards: **"Total de Registos"** e **"Total de Kanbans"** — métricas diretas e operacionalmente relevantes

---

## v4.7.7 — Abr 2026

### 🖱️ Modal de Detalhes no Gráfico de Erros
- Clique nas barras/segmentos do gráfico circular de Tipos de Erro abre modal com lista detalhada dos registos desse tipo
- Modal inclui estatísticas rápidas (registos, kanbans, serviços) e tabela ordenada por data

---

## v4.7.6 — Abr 2026

### 🖱️ Modal de Detalhes em Todos os Gráficos Operacionais
- Clique em qualquer barra dos gráficos Operacionais (Hora, Dia da Semana, Dia, Mês) abre modal com registos do período clicado
- Modal com estatísticas rápidas e tabela filtrada
- Fecha com botão ✕, tecla ESC ou clique fora do modal

---

## v4.7.5 — Mar 2026

### 🔧 Análise KB Perdido por Último Estado RFID
- Novo bloco no Dashboard de Qualidade: distribuição dos registos com erro **KB Perdido** agrupados pelo último estado do RFID (supermercado / armazém)
- Campo "Último Estado do RFID" torna-se obrigatório quando o Tipo de Erro selecionado é KB Perdido (formulário individual e batch)

---

## v4.7.4 — 05 Mar 2026

### 🗓️ Novo Gráfico: Atividade por Mês
- Adicionado gráfico **"🗓️ Atividade por Mês"** no dashboard analítico (após "Atividade por Dia")
- Agrupa registos por mês (`YYYY-MM`) e apresenta barras proporcionais ao volume
- **Cores distintas por ano** — azul (#0EA5E9), verde (#10B981), roxo (#8B5CF6), âmbar (#F59E0B), vermelho (#EF4444) — para distinguir dados de múltiplos anos
- **Legenda de anos** gerada automaticamente quando existem dados de mais de um ano
- Padding automático adaptativo conforme o valor máximo (igual lógica dos outros gráficos)
- Scroll horizontal com largura de coluna calculada dinamicamente
- Hover animado com elevação e sombra colorida
- Tooltip com nome do mês, ano e número de registos
- Mensagem "Sem dados no período" quando não há registos

---

## v4.7.3 — 05 Mar 2026

### 🔢 Correção: Ordenação "Distribuição por Origem"
- Widget **"Distribuição por Origem"** no dashboard de gestão agora ordena as origens por percentagem **descendente** (maior para menor)
- Antes: ordem de inserção dos dados (arbitrária)
- Depois: ordem decrescente por número de registos (equivalente à percentagem)

---

## v4.7.2 — 23 Fev 2026

### 📊 Gráfico "Atividade por Dia" — Alturas Proporcionais
- Altura das barras agora proporcional ao valor real
- Corrigido mínimo de 50px que tornava barras com valores baixos visualmente iguais
- Mínimo reduzido para 8px — diferença visual clara entre 1 e 16 registos

---

## v4.7.1 — Fev 2026

### 📐 Gráfico "Atividade por Dia" — Largura Dinâmica
- Largura das colunas calculada dinamicamente com base na largura real do contentor e número de dias
- Tipografia e espaçamento adaptam-se proporcionalmente à largura da coluna

---

## v4.7.0 — Fev 2026

### 🆕 Batch Múltiplos Serviços
- Mesmo artigo pode ser registado para vários serviços em simultâneo
- Seletor de modo batch: Artigos / Serviços
- Campos comuns: artigo, armazém, idTag, origem, erro
- Linhas dinâmicas de serviços com `qtdKanbans` individual
- Auto-completar: artigo preenche armazém, serviço mostra nome

---

## v4.6.0 — Fev 2026

### 📄 Relatórios PDF Executivos
- Geração de relatórios PDF com sumário executivo
- Distribuição por origem com barras visuais no PDF
- Top 5 serviços por volume em tabela formatada
- Footer com data de geração e número de página em todas as páginas

---

## v4.5.3 — 04 Fev 2026

### 💾 Backup JSON + Export Excel
- Backup automático em formato JSON para segurança dos registos
- Export para Excel (`.xlsx`) para análise e relatórios
- Dois formatos distintos para diferentes necessidades
- Backup automático JSON mantido em paralelo

---

## v4.3.1 — Jan 2026

### 🔢 Código com 10 Dígitos
- Códigos de registo formatados com 10 dígitos com zeros à esquerda

---

## v4.3.0 — Jan 2026

### ✅ Validação de Nomes
- Corrigida validação de nomes de serviços e artigos

---

## v4.2.0 — Jan 2026

### ⭐ Suporte ESTADO_CODIGO
- Adicionado suporte para campo `ESTADO_CODIGO` nos registos

---

*Ficheiro mantido manualmente pelo responsável técnico da aplicação.*
