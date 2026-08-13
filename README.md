# 📦 Análise KPI para Manutenção do Planeamento

> Ferramenta web **100% offline** para controlo e análise de Kanban e gestão de KPI para equipas de manutenção de supermercados.

**Versão atual:** 4.11.5 — servida como `index.html` (cópia versionada: `kanban-kpi-analyzer-v4_11_5.html`)

---

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Características](#características)
- [Como Usar](#como-usar)
- [Formato dos Ficheiros](#formato-dos-ficheiros)
- [Requisitos Técnicos](#requisitos-técnicos)
- [Controlo de Versões (Git)](#controlo-de-versões-git)
- [Histórico de Versões](#histórico-de-versões)

---

## 🎯 Sobre o Projeto

Esta aplicação web permite analisar o trabalho de manutenção do sistema de dupla caixa e a impressão de indicadores visuais (kanbans).

### Princípios da Impressão de Kanbans

1. Garantir que a informação está correta e atualizada
2. Garantir que todos os kanbans sejam contabilizados
3. Diminuir ruturas de fornecimento dos serviços
4. Gerar KPI para o serviço

---

## ✨ Características

### Interface Moderna e Intuitiva
- ✅ Design profissional com tema claro (Medical Brutalist)
- ✅ Feedback visual em tempo real
- ✅ Animações suaves e layout responsivo
- ✅ 100% offline — sem necessidade de internet
- ✅ **Progressive Web App** — instalável no ecrã inicial (Android/iOS/Desktop) e utilizável offline após a primeira visita online

### Separadores Principais

| Separador | Função |
|---|---|
| **📋 Registos** | Formulário individual, batch (múltiplos artigos ou serviços) e histórico pesquisável |
| **📊 Dashboards** | Análise gráfica e estatística — Operacional, Gestão, Qualidade |
| **📄 Relatórios** | Geração de briefings executivos em PDF (mensal e anual) |
| **💾 Gestão dos Dados** | Carregar ficheiro de referência, importar/exportar, backups |

---

## 🚀 Como Usar

### Passo 1: Carregar Ficheiro de Referência

Antes de registar, aceda a **💾 Gestão dos Dados** e carregue o ficheiro Excel com as tabelas de referência. Sem este passo, o autocompletar de artigos e serviços não funciona.

### Passo 2: Registo Individual

Preencha os campos obrigatórios e opcionais no separador **📋 Registos → Identificação**:

| Campo | Obrigatoriedade | Descrição |
|---|---|---|
| Data | Automático | Preenchida com a data atual; editável |
| Utilizador | Obrigatório | Selecionado da tabela T_Utilizadores |
| Serviço | Obrigatório | ID do serviço com autocompletar |
| Artigo | Obrigatório | Código do artigo com autocompletar |
| Armazém | Automático | Preenchido ao selecionar o artigo |
| Origem | Obrigatório | Carregado dinamicamente de T_Origem |
| Quantidade de Kanbans | Obrigatório | Mínimo 1 |
| Tipo de Erro | Obrigatório | Carregado de T_Erros |
| ID Tag | Opcional | Identificador de etiqueta física |
| Observações | Opcional | Campo de texto livre |

> Quando o Tipo de Erro é **KB Perdido**, o campo **Último Estado do RFID** torna-se obrigatório.

> **Serviço e Artigo têm de existir nas referências** (v4.11.2). O registo só é aceite se o ID do serviço e o código do artigo constarem das tabelas carregadas — é daí que vêm a descrição, o local e o armazém. O código do artigo pode ser escrito sem os zeros à esquerda; é gravado na forma canónica de 10 dígitos.

### Passo 3: Registo em Batch

Aceda a **📋 Registos → Batch** para registar múltiplos itens de uma vez:

| Modo | Quando usar |
|---|---|
| **Múltiplos Artigos** | Um serviço → vários artigos diferentes |
| **Múltiplos Serviços** | Um artigo → vários serviços diferentes |

### Passo 4: Análise no Dashboard

Aceda a **📊 Dashboards** para análise gráfica. Todos os dashboards suportam filtros de data e origem. Clicar nas barras dos gráficos abre um modal com os registos detalhados do período.

---

## 💾 Gestão de Dados

### Ficheiro de Referência

Ficheiro Excel (`.xlsx`) com as seguintes folhas obrigatórias:

| Folha | Colunas Obrigatórias |
|---|---|
| **T_Artigo** | `CODIGO`, `DESCRICAO_CODIGO`, `ARMAZEM`, `ESTADO_CODIGO` |
| **T_Serviços** | `ID_SERVICO`, `DESCRICAO_SERVICO`, `LOCAL_SERVICO`, `SERVICO_ATIVO` |
| **T_Utilizadores** | `UUID_UTILIZADOR`, `DESCRICAO_UTILIZADOR`, `UTILIZADOR_ATIVO` |
| **T_Erros** | `CODIGO_ERRO`, `DESCRICAO_ERRO`, `ERRO_ATIVO` |
| **T_Origem** *(opcional)* | `ID_ORIGEM`, `DESCRICAO_ORIGEM`, `ORIGEM_ATIVO` |

> Apenas registos com `*_ATIVO = true` são carregados (aceite também como texto "VERDADEIRO"/"TRUE"/"SIM" ou número `1` — ver `isValorAtivo()`, v4.9.9). Se T_Origem não existir, são usados valores padrão (Armazém, HPH, ACES).

---

## 🛠️ Requisitos Técnicos

| Browser | Versão Mínima |
|---|---|
| Google Chrome | 90+ |
| Microsoft Edge | 90+ |
| Mozilla Firefox | 88+ |
| Safari | 14+ |

> **Instalação como app / modo offline (PWA):** requer HTTPS ou `localhost` — o Service Worker não regista em `file://`. Sem HTTPS, a aplicação continua a funcionar normalmente no browser, apenas sem instalação nem cache offline das bibliotecas CDN.

### Recursos Utilizados
- **SheetJS (xlsx.js):** Processamento de ficheiros Excel
- **jsPDF + AutoTable:** Geração de relatórios PDF
- **LocalStorage:** Armazenamento local de dados
- **File API / Blob API:** Upload e download de ficheiros
- **Service Worker (`sw.js`) + `manifest.json`:** Instalação como PWA e cache-first para funcionamento offline

---

## 🔀 Controlo de Versões (Git)

### Convenções deste projecto

**Ficheiro:** `kanban-kpi-analyzer-v{major}_{minor}_{patch}.html`  
**Tag git:** `v{major}.{minor}.{patch}`  
**Versionamento:** [Semantic Versioning](https://semver.org/)

| Tipo | Quando | Exemplo |
|---|---|---|
| **Patch** | Bug fix, texto, CSS | `v4.9.8 → v4.9.9` |
| **Minor** | Nova feature, novo campo | `v4.9.13 → v4.10.0` |
| **Major** | Redesign, quebra de dados | `v4.9.8 → v5.0.0` |

### Workflow por alteração

```bash
# 1. Ver estado actual
git status

# 2. Adicionar alterações
git add index.html kanban-kpi-analyzer-v4_11_5.html versao.md README.md

# 3. Commit com mensagem descritiva
git commit -m "fix(export): descrição do Tipo de Erro em falta no Excel | kanban-kpi-analyzer-v4_11_5.html"

# 4. Enviar para GitHub
git push

# 5. Criar tag de versão
git tag -a v4.11.5 -m "Descrição curta da alteração"
git push origin v4.11.5
```

### Localização obrigatória das 5 actualizações de versão no HTML

Ao incrementar a versão, actualizar **exactamente** estes 5 locais no HTML:

```
1. <title>...</title>
2. Comentário CSS no topo do bloco <style>
3. const APP_VERSION = '...'
4. <span id="appVersionDisplay" class="version">v... 📊</span>
5. Bloco de changelog nos comentários CSS
```

### Inicialização (primeira vez)

```bash
git clone https://github.com/SEU-USER/kanban-kpi-analyzer.git
cd kanban-kpi-analyzer
# Ou usar setup_git.sh se for repositório novo
```

---

## 📝 Histórico de Versões

Consulte o ficheiro [`versao.md`](./versao.md) para o histórico completo.

| Versão | Data | Destaque |
|---|---|---|
| **4.11.5** | 13 Ago 2026 | 🐛 Fix: Descrição do Tipo de Erro em falta no Excel exportado |
| 4.11.4 | 07 Ago 2026 | 📱 Fix: layout responsivo partido em telemóvel (separadores sem quebra de linha) |
| 4.11.3 | 03 Ago 2026 | 🎨 Ícone Kkpi nas 4 variantes + favicon |
| 4.11.2 | 03 Ago 2026 | 🚑 PWA reparada (app shell nunca instalava) + validação de serviço/artigo nas referências |
| 4.11.1 | 19 Jul 2026 | 🔒 SRI nos scripts CDN + escape de mensagens de alerta |
| 4.11.0 | 18 Jul 2026 | 📌 App servida como `index.html` estável |
| 4.10.0 | 11 Jul 2026 | 📱 Progressive Web App — instalável e utilizável offline (`manifest.json` + `sw.js`) |
| 4.9.13 | 11 Jul 2026 | 📅 Limite de 40 dias no gráfico "Atividade por Dia" |
| 4.9.12 | 02 Jul 2026 | 🧹 Refactor: filtros rápidos unificados (`calcularIntervaloDataRapido`) |
| 4.9.11 | 02 Jul 2026 | 🎨 Cores de origem dinâmicas (fix roxo duplicado + badges dinâmicos) |
| 4.9.10 | 02 Jul 2026 | 🐛 Consistência de filtros de origem (Gestão vs Qualidade) e duplicados |
| 4.9.9 | 02 Jul 2026 | 🔒 Fixes de segurança (XSS) e robustez (`isValorAtivo`) |
| 4.9.8 | 11 Jun 2026 | 🐛 Fix utilizador "undefined" após reestruturação T_Utilizadores v4.8 |
| 4.9 | 10 Mai 2026 | 🧹 Limpeza de código — −860 linhas, −10% tamanho |
| 4.8 | 09 Mai 2026 | 🔄 Origens dinâmicas + backup unificado |
| 4.7.8 | Mai 2026 | 🗑️ Remoção "Anomalias" + novos stat cards |
| 4.7.6 | Abr 2026 | 🖱️ Modal de detalhes em todos os gráficos |
| 4.7.0 | Fev 2026 | 🆕 Batch múltiplos serviços |
| 4.6.0 | Fev 2026 | 📄 Relatórios PDF executivos |

---

*"A simplicidade é o mais alto grau de sofisticação." — Leonardo da Vinci*

**Desenvolvido para: Equipa de Manutenção do Planeamento**
