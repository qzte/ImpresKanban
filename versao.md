# 📋 Histórico de Versões — Kanban KPI Analyzer

> Registo completo de todas as alterações, correções e melhorias da aplicação.

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
