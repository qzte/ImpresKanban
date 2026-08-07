# 📋 Histórico de Versões — Kanban KPI Analyzer

> Registo completo de todas as alterações, correções e melhorias da aplicação.

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
- **Fix:** badges de origem e "Distribuição por Origem" só conheciam Armazém/HPH/ACES hardcoded — agora usam `obterCorOrigem()` derivada da posição em `tOrigem`
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
- **Origens dinâmicas:** dropdown de Origem no formulário, batch e histórico carregado diretamente de `tOrigem` — sem hardcoding de "Armazém/HPH/ACES"
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
