# Fixtures dos testes de interface

## `cdn-libs/`

`xlsx.full.min.js`, `jspdf.umd.min.js` e `jspdf.plugin.autotable.min.js` são
**bytes idênticos** aos ficheiros que `index.html` carrega da CDN
(`window.CDN_LIBS`) — confirmado comparando o SHA-384 de cada um com o
`integrity` já declarado em `index.html`:

| Ficheiro | SHA-384 (= `integrity` em `index.html`) |
|---|---|
| `xlsx.full.min.js` | `vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw` |
| `jspdf.umd.min.js` | `JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk` |
| `jspdf.plugin.autotable.min.js` | `vuyrTV5nkscLp1knFvt+FIHfKKzmROBq5reruhMRslauj54mW+l2B8b6szMN6lCL` |

Foram obtidos da versão correspondente no [registo npm](https://registry.npmjs.org/)
(`xlsx@0.18.5`, `jspdf@2.5.1`, `jspdf-autotable@3.5.31`) em vez da CDN
(`cdnjs.cloudflare.com`) porque nem todos os ambientes onde os testes correm
(incluindo o desta sessão) têm acesso a essa CDN — o registo npm é mais
consistentemente acessível. São o mesmo ficheiro: só a origem do download
muda, o conteúdo publicado é o mesmo em ambos.

**Para que servem:** `e2e/csp.e2e.js` usa-os para testar Importar
Referências, Exportar Dados e Relatórios PDF com as bibliotecas reais (não
stubs), sob o Content-Security-Policy da app — sem depender da CDN estar
acessível nem introduzir flakiness de rede no CI. `e2e/helpers.js`
(`servirFixturesCDN`) intercepta os 3 pedidos para `cdnjs.cloudflare.com` e
responde com estes ficheiros; o resto da app continua inalterado, incluindo
em produção — isto só existe para os testes.

**Ao atualizar a versão de uma destas bibliotecas em `index.html`
(`window.CDN_LIBS`):** repetir o processo abaixo e voltar a comparar o hash
com o novo `integrity`. Se não repetir, o teste falha com um erro de rede
(a fixture antiga já não corresponde à URL nova) — não falha em silêncio.

```bash
cd /tmp && npm pack xlsx@<versão> jspdf@<versão> jspdf-autotable@<versão>
for f in *.tgz; do tar xzf "$f"; done
openssl dgst -sha384 -binary package/dist/<ficheiro>.min.js | openssl base64 -A
# comparar com o `integrity` em index.html; copiar para e2e/fixtures/cdn-libs/
```

## `referencias-exemplo.xlsx`

Workbook mínimo e válido para testar **Importar Referências**: as 4 sheets
obrigatórias (`T_Artigo`, `T_Serviços`, `T_Utilizadores`, `T_Erros`) com as
colunas exigidas por `carregarReferencia()`, 1–2 linhas cada. Gerado com
SheetJS (o mesmo `xlsx` de `cdn-libs/`) e commitado em vez de gerado a cada
run — é um ficheiro `.xlsx` binário, não um JSON fácil de escrever à mão.

Para regenerar (por exemplo, para acrescentar uma sheet `T_Origem` a um
teste novo):

```bash
cd /tmp && npm pack xlsx@0.18.5 && tar xzf xlsx-0.18.5.tgz
node -e "
const XLSX = require('./package');
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
  { CODIGO: 12345, DESCRICAO_CODIGO: 'Luvas Nitrilo M', ARMAZEM: 1, ESTADO_CODIGO: 'Ativo' },
  { CODIGO: 67890, DESCRICAO_CODIGO: 'Seringa 5ml', ARMAZEM: 2, ESTADO_CODIGO: 'Ativo' },
]), 'T_Artigo');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
  { ID_SERVICO: 101, DESCRICAO_SERVICO: 'Urgência', LOCAL_SERVICO: 'Piso 0', SERVICO_ATIVO: true },
  { ID_SERVICO: 202, DESCRICAO_SERVICO: 'Pediatria', LOCAL_SERVICO: 'Piso 2', SERVICO_ATIVO: true },
]), 'T_Serviços');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
  { UUID_UTILIZADOR: 'user-1', DESCRICAO_UTILIZADOR: 'Ana Silva', UTILIZADOR_ATIVO: true },
]), 'T_Utilizadores');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
  { CODIGO_ERRO: 1, DESCRICAO_ERRO: 'Sem erro', ERRO_ATIVO: true },
  { CODIGO_ERRO: 5, DESCRICAO_ERRO: 'Kanban danificado', ERRO_ATIVO: true },
]), 'T_Erros');
XLSX.writeFile(wb, 'referencias-exemplo.xlsx');
"
# copiar para e2e/fixtures/referencias-exemplo.xlsx
```
