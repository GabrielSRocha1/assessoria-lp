# Projeto — LP Verum (Assessoria Global em Ativos Digitais)

Landing page single-page, estática, com globo 3D em WebGL (Three.js).
Documento de referência: como o projeto está montado, as regras de edição e o registro
das alterações. **Ler antes de mexer em qualquer coisa.**

Última atualização: 22/11/2026

---

## 1. Regra de ouro

> **Edite sempre `src/page.html` (e `src/i18n.js`) e rode `node build/sync.mjs`.**
> Nunca edite `lp-assessoria.html` nem `index.html` à mão — os dois são gerados.

```bash
node build/sync.mjs     # regenera lp-assessoria.html E index.html a partir do src
git add -A && git commit -m "..." && git push   # publica (GitHub Pages serve o main)
```

**Página no ar:** https://gabrielsrocha1.github.io/assessoria-lp/
**Repositório (público):** https://github.com/GabrielSRocha1/assessoria-lp — Pages
servindo o branch `main` na raiz (`index.html`, cópia idêntica do entregável, gerada
pelo próprio `sync.mjs` desde 22/11/2026). Depois do push, o Pages leva ~1 min para
refletir. Atenção: repositório público = `PROJETO.md`, fonte e token visíveis (o
token já aparece no HTML publicado de qualquer forma — limitação aceita do §3).

O `sync.mjs` reaproveita o bundle do globo e as texturas que já estão embutidos no
`lp-assessoria.html` e reaplica todo o HTML/CSS/JS vindo do `src`. Ele existe porque o
build oficial precisa de `node_modules` só por causa do globo — que raramente muda.
Se o globo mudar (`globe.js`, `countries.json`, texturas), aí sim é `npm install` +
`node build/build.mjs` (ver §3).

Antes do `sync.mjs` (até 21/11/2026) as duas cópias eram editadas à mão. Se encontrar
divergência entre os arquivos, a fonte da verdade é o `src/`.

Eles não são cópias idênticas — são **fonte** e **produto**:

| Arquivo | Tamanho | O que é |
|---|---|---|
| `src/page.html` | ~85 KB | Template. Tem 4 placeholders e **não funciona sozinho** no navegador (globo quebrado). |
| `lp-assessoria.html` | ~1,2 MB | Build final autossuficiente: JS, texturas e dados embutidos em base64. **É o arquivo que se publica.** |

Placeholders que existem só no template:
`__FAVICON__`, `__LOGO__`, `__EARTH_LO__`, `__ASSETS_JSON__`, `__DATA_JSON__`,
`/*__GLOBE_BUNDLE__*/`, `/*__I18N__*/`

O HTML/CSS é igual nos dois; o que muda é que o `sync.mjs` (ou o build) substitui os
placeholders pelos blobs em base64 e pelo dicionário de idiomas.

---

## 2. Estrutura

```
lp-assessoria/
├── index.html           ← PÁGINA PUBLICADA no GitHub Pages (gerado; nunca editar à mão)
├── lp-assessoria.html   ← entregável local, idêntico ao index.html (gerado)
├── README.md  .gitignore
├── PROJETO.md           ← este arquivo
├── apps-script.gs       ← código do Google Apps Script (cópia do publicado)
├── package.json
├── src/
│   ├── page.html        ← FONTE do markup e do estilo (com placeholders)
│   ├── i18n.js          ← FONTE do dicionário PT / EN / ES
│   ├── entry.js         ← entrypoint do bundle
│   ├── globe.js         ← lógica do globo 3D
│   └── countries.json   ← países, bandeiras e conexões
├── assets/
│   ├── earth-2k.jpg (279K)  earth-lo.jpg (22K)   clouds.jpg (89K)
│   ├── water.jpg (52K)      bump.jpg (24K)       atlas-q.png (43K)
│   ├── logo-512.png (126K)  ← master do logotipo
│   ├── logo-128.png (19K)   ← usado no cabeçalho/rodapé
│   └── favicon-64.png (6K)
├── build/
│   ├── sync.mjs         ← REGENERA o entregável sem node_modules (uso diário)
│   ├── build.mjs        ← build completo com esbuild → dist/index.html
│   ├── atlas.mjs  full.mjs  shot.mjs
└── test/run.mjs
```

Não apagar `src/`: é o único lugar onde existe o código do globo. Sem `src/page.html`
nem o `sync.mjs` nem o build funcionam.

---

## 3. Build — estado atual

**Não há `node_modules` instalado, e por enquanto não precisa.**
Para editar CSS, textos, traduções ou layout: mexer no `src/` e rodar
`node build/sync.mjs` (§1).

`node_modules` só é necessário para mexer no **globo**: velocidade/inclinação da rotação,
países exibidos, texturas da Terra, ou qualquer JavaScript.

### Se um dia for preciso rebuildar

```bash
npm install          # ~200 MB
node build/build.mjs # gera dist/index.html
```

Dependências (de `package.json`): `three`, `three-globe`, `topojson-client`,
`world-atlas`, `country-flag-icons`; dev: `esbuild`, `puppeteer-core`, `pngjs`.

**Três coisas quebradas que vão aparecer:**

1. `build/build.mjs:4` usa `new URL(import.meta.url).pathname`, que no Windows resulta
   em `/C:/Users/...` e estoura no `path.resolve`. Correção de uma linha:
   trocar por `fileURLToPath` de `node:url`.
2. `build/shot.mjs` e `test/run.mjs` apontam para `/home/claude/...` e
   `/usr/bin/google-chrome` — são da máquina Linux onde a página foi gerada
   originalmente. Não rodam no Windows como estão.
3. O build escreve em `dist/index.html`. O `lp-assessoria.html` da raiz é uma **cópia
   renomeada** desse output — depois de rebuildar, é preciso copiar por cima
   (e aí as edições manuais feitas direto no arquivo final se perdem, se não
   estiverem também no `src/page.html`).

### Configuração de atendimento (WhatsApp e quiz)

O número fica em **um lugar só**, no `<script>` inline no fim da página
(`src/page.html:634`):

```js
var CONFIG = window.LP_CONFIG || {
  whatsapp: '5545988280299',   // DDI+DDD, só dígitos
  formEndpoint: '…/exec',      // Web App do Apps Script que grava na planilha
  formToken: '…',              // igual à constante TOKEN do Apps Script
  meetingUrl: ''               // URL fixa de sala, SÓ RESERVA — o Meet único por lead
};                             // criado pelo Apps Script tem prioridade (ver §3 Quiz)
```

Número atual: **+55 45 98828-0299**.

Como funciona desde 22/11/2026: todo clique em `[data-cta]` — os 8 CTAs das seções,
os links "Contato" do menu e do rodapé e o botão flutuante — **abre o modal do quiz
conversacional** (`#quiz`), não mais o WhatsApp direto. O WhatsApp entra no **fim** do
fluxo: depois de confirmar o agendamento, o lead clica em "Confirmar minha vaga no
WhatsApp", que abre `wa.me/<numero>` com mensagem contendo nome, empresa e horário.
Se a URL tiver `utm_source`/`utm_medium`/`utm_campaign`, eles entram no fim da mensagem
como `[origem: ...]` (via `utmTag()` dentro de `waLink()`).

O mapa `MSG` continua no código (exportado em `window.LP.MSG`) mas nenhum CTA o usa
mais — ficou como sobra barata. `window.LP.abrirQuiz('origem')` abre o quiz via console.

Para trocar o número depois, basta editar essa linha no `src/page.html` e rodar o
`sync.mjs` — não há número repetido em nenhum outro ponto (não existe `tel:` nem
telefone no JSON-LD). As linhas do registro de 21/11 mencionam "nos dois arquivos"
porque são anteriores ao `sync.mjs`.
Também dá para sobrescrever sem tocar no HTML, declarando `window.LP_CONFIG` antes
desse script.

### Quiz conversacional (captação e agendamento)

Desde 22/11/2026 a captação é um **chat de qualificação em modal** (substituiu o
formulário da antiga seção `#contato`). Peças, todas em `src/page.html`:

- CSS: bloco `/* QUIZ CONVERSACIONAL (modal) */` no fim do `<style>` (`:250`),
  tudo com prefixo `.qz-`.
- HTML: modais `#quiz` (`:550`) e `#lgpd` (política de privacidade, `:573`),
  depois do botão flutuante. Só o "chrome" é estático; o chat é gerado por JS.
- JS: bloco `/* QUIZ CONVERSACIONAL */` (`:~800`), no lugar do antigo JS do form.

Fluxo: intro (2 bolhas + pergunta) → nome → sobrenome (com "Pular") → WhatsApp
(máscara BR, DDD 11-99, 10-11 dígitos) → empresa → segmento (botões + busca sem
acento) → cargo → faturamento → e-mail → 3 bolhas de fechamento → card de agenda.

**Agenda (grade fixa, sem integração):** configurada em `QUIZ_AGENDA`
(`src/page.html:809`) — `slots` (horários), `horizonteDias` (28) e `antecedenciaMin`
(60 min de folga para horários de hoje). Só dias úteis. Datas sempre com construtor
local `new Date(y,m,d)` — nunca parse de string ISO (seria UTC e viraria véspera).

**Persistência:** o lead é enviado **uma única vez**, ao clicar em "Confirmar
agendamento", via `enviarLead()` com `tipo:'quiz'` → aba **Quiz** da planilha.
Fechar o modal (ESC/×) não reseta; reabrir retoma no mesmo pageview. Não há
salvamento parcial por abandono — `appendRow` não atualiza linha e o duplo
salvamento geraria 2 linhas por lead no caminho feliz. Se um dia os dados mostrarem
abandono relevante na agenda, o upgrade é um `sendBeacon` em `pagehide` guardado por
`respostas.email && !enviado` (~12 linhas, isolado).

**Eventos no dataLayer:** `quiz_open {origem}`, `quiz_step_N {etapa}`,
`quiz_schedule`, `quiz_confirm`, `quiz_whatsapp`, `lead_save_error`, além do
`cta_click` genérico (que **renomeou** o antigo `cta_whatsapp_click` — se houver
GTM/pixel configurado com o nome antigo, atualizar lá).

**Política de privacidade:** modal `#lgpd` com texto padrão LGPD (controlador,
dados, finalidade, base legal, direitos). **É texto padrão, não revisado por
jurídico** — revisar antes de campanha paga. Linkado no rodapé da página, no rodapé
do modal e na microcopy de consentimento do primeiro input (o payload envia
`consentimento: true` por esse aceite implícito ao prosseguir).

**Idiomas:** o quiz é **só em PT**, por decisão — as bolhas são DOM dinâmico e não
passam pelo i18n (o TreeWalker roda uma vez no load). Visitantes EN/ES veem a página
traduzida, mas o quiz em português. O chrome estático do modal fica em PT pelo mesmo
mecanismo (chave ausente = fallback PT); só "Política de Privacidade" tem tradução.

### Quiz → Google Sheets

O quiz grava o lead numa planilha da conta **verumpalestras@gmail.com** ao confirmar
o agendamento e, no card final, oferece o botão de WhatsApp com os dados. Mesmo se a
gravação falhar, o lead não se perde — ele está na mensagem do WhatsApp.

- **Código do Apps Script:** `apps-script.gs`, na raiz do projeto (cópia do que está
  publicado; o original vive na planilha, em Extensões → Apps Script).
- **Endpoint:** `CONFIG.formEndpoint`, na mesma linha do WhatsApp.
- **Token:** `CONFIG.formToken` precisa ser idêntico à constante `TOKEN` do Apps Script.
  Hoje: `assessoria-verum-2026`.
- **Roteamento:** payload com `tipo:'quiz'` → aba **Quiz**; qualquer outro payload →
  aba **Leads** (caminho antigo, intacto — retrocompatível).
- **Colunas da aba Quiz (14):** Data · Nome · Sobrenome · WhatsApp · Empresa ·
  Segmento · Cargo · Faturamento · E-mail · Reuniao · Consentimento · Origem (UTM) ·
  Pagina · **Meet**. A Data é `new Date()` do servidor; `Reuniao` vai como
  `dd/mm/aaaa hh:mm`; `Meet` guarda o link da sala criada (ou o erro, se falhar).
- **Ordem de deploy (não inverter):** colar o `apps-script.gs` novo na planilha,
  **habilitar o serviço avançado "Google Calendar API"** (editor → Serviços (+) →
  Google Calendar API → Adicionar) e **Implantar → Gerenciar implantações → ✏️ →
  Nova versão** ANTES de publicar a página nova. Script novo + página antiga
  funciona; página nova + script antigo grava o quiz **desalinhado na aba Leads**
  (segmento/cargo/faturamento se perdem). A função `testeQuiz()` no editor cria a
  aba, uma linha `TESTE QUIZ - apagar` **e um evento real na agenda** (apagar os dois).

### Evento no Google Agenda + Meet único por lead (22/11/2026)

Ao gravar um lead do quiz, o Apps Script também **cria um evento de 45 min** no
Google Agenda da conta `verumpalestras@gmail.com` (função `criarEventoQuiz`):

- Título `Reuniao Verum - Nome (Empresa)`, descrição com todos os dados do lead.
- **Link de Meet exclusivo** por reunião (`conferenceData` da Calendar API avançada;
  é por isso que o serviço precisa estar habilitado no editor).
- **Convida o lead pelo e-mail** informado (`sendUpdates:'all'`) — o Google envia o
  convite e os lembretes automáticos. Limite do Gmail comum: ~100 convites/dia.
- Horário montado como texto + `timeZone:'America/Sao_Paulo'` (`TZ_AGENDA`) — não
  depende do fuso do servidor do Google. Duração em `DURACAO_REUNIAO_MIN`.
- A resposta volta `{ok:true, meet:<link>}`: a página troca o link do botão
  "Ver link de acesso da reunião" pelo Meet único (o `CONFIG.meetingUrl` fixo é só
  fallback, usado se a criação falhar ou enquanto a resposta não chega).
- **Falha na agenda nunca bloqueia o lead**: `try/catch` no `gravarQuiz` — a linha é
  gravada do mesmo jeito e a coluna Meet registra `ERRO: ...` para diagnóstico
  (inclusive se alguém esquecer de habilitar a Calendar API).

**Limitação aceita:** a grade do quiz continua fixa — **dois leads ainda podem
escolher o mesmo horário** (cada um vira um evento separado na agenda). Se choques
começarem a acontecer, o próximo passo é o script responder consultas de
disponibilidade (`doGet` lendo a agenda) e o quiz esconder horários ocupados.

**Consentimento (LGPD):** a coluna registra `Sim` a partir do aceite implícito do
quiz — a microcopy "Ao continuar, você concorda com a Política de Privacidade" exibida
junto ao primeiro input (22/11/2026). O texto completo está no modal `#lgpd`. Se esse
texto mudar, vale anotar a data aqui — a planilha guarda o aceite e o horário, não a
versão do texto.

**Aviso de falha:** o envio usa `fetch` e **lê** a resposta do Apps Script (ele devolve
`Access-Control-Allow-Origin`, verificado em 21/11/2026 — `response.type === 'cors'`).
Se não vier `{"ok":true}` em até 15s, aparece uma bolha âmbar no chat
(`.qz-bubble--warn`) dizendo que o registro não pôde ser confirmado e orientando a
confirmar pelo WhatsApp; também dispara o evento `lead_save_error` no dataLayer.
Antes de avisar, ainda tenta um `sendBeacon` silencioso. O card "Horário reservado!"
aparece na hora — a bolha de aviso só surge se a confirmação falhar.

**Detalhe que não é opcional:** o envio usa `Content-Type: text/plain;charset=UTF-8`,
não `application/json`. Content-type "simples" não dispara o preflight `OPTIONS`, e o
Apps Script não responde a `OPTIONS` — com `application/json` a gravação falha em
silêncio. O script lê o corpo com `e.postData.contents` e faz o `JSON.parse` do mesmo
jeito. Se alguém "consertar" isso para `application/json` no futuro, quebra.

Limitações aceitas: a URL do endpoint fica visível no código-fonte (inerente a site
estático) e o envio é *fire-and-forget* via `sendBeacon` — a página não sabe se a
gravação deu certo. O token filtra envio casual de lixo; se aparecer spam, trocar o
token e reimplantar.

Ao editar o Apps Script: **Implantar → Gerenciar implantações → ✏️ → Nova versão**.
Só salvar não atualiza o que está no ar.

---

## 4. Convenção de CSS adotada

Padrão usado nos ajustes de dobra: **medidas que escalam também pela altura da janela**,
não só pela largura.

```css
/* tamanho de fonte que respeita largura E altura */
font-size: clamp(MIN, min(Xvw, Yvh), MAX);

/* espaçamentos que encolhem em telas baixas */
margin-bottom: clamp(MIN, Zvh, MAX);
```

Por que: a reclamação original era que em notebooks de tela baixa (~615–633px úteis)
o botão caía abaixo da dobra. Só reduzir por `vw` não resolve — uma tela 1253×615 e outra
1253×900 têm a mesma largura e necessidades opostas. Com `min(vw, vh)` o bloco encolhe
em tela baixa e volta ao tamanho cheio em monitor grande.

Regra prática: os `clamp` são sempre escopados à seção (`.hero ...`, `.freedom ...`)
para não afetar o resto da página.

### Variáveis e breakpoints

Variáveis em `:root` — `--hdr:72px` (altura do header fixo), `--container:1220px`,
`--gold:#d6b46a`, `--bg:#05070b`, fontes `Sora` (display) e `Manrope` (corpo).

| Breakpoint | Efeito |
|---|---|
| ≤ 1080px e ≥ 901px | coluna do globo da seção Liberdade encolhe para `.56fr` |
| ≤ 980px | menu de navegação some |
| ≤ 900px | hero e Liberdade empilham (globo em cima); botões 100% de largura |
| ≤ 860px / 820px | grids de públicos, confiança e callout viram 1 coluna |
| ≤ 520px / 420px | CTA do header encurta; pílulas de ativos ocupam a linha toda |

`.sec` tem `padding: clamp(76px,10vw,128px) 0` global. A seção `.freedom` sobrescreve
esse padding (vem depois no arquivo, mesma especificidade).

---

## 5. Como testar localmente

A extensão do Chrome **não consegue redimensionar a janela** nesta máquina
(`resize_window` retorna sucesso mas o viewport não muda; a primeira aba chegou a ficar
presa em emulação mobile 321×511). O jeito confiável de medir qualquer viewport:

**a) subir um servidor** (file:// é bloqueado pela extensão):

```bash
node -e "const http=require('http'),fs=require('fs'),path=require('path');
http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);
if(p==='/')p='/lp-assessoria.html';fs.readFile(path.join(process.cwd(),p),(e,d)=>{
if(e){s.writeHead(404);s.end();return}
s.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});s.end(d)})
}).listen(8731)"
```

**b) medir dentro de um iframe de tamanho fixo** — as unidades `vh`/`vw` dentro do iframe
resolvem pelo tamanho dele, então dá para simular qualquer tela independente da janela real:

```js
const f = document.createElement('iframe');
f.style.cssText = 'position:fixed;left:0;top:0;width:1253px;height:615px;border:0;'
                + 'z-index:99999;transform:scale(.25);transform-origin:0 0';
f.src = '/lp-assessoria.html?v=' + performance.now();   // ?v= fura o cache
document.body.appendChild(f);
// depois do load: f.contentDocument.querySelector('.freedom').getBoundingClientRect()
```

Viewport de referência do cliente: **1253×615 a 1255×633** (o print original).
Encerrar o servidor depois: `netstat -ano | grep 8731` + `taskkill //PID <pid> //F`.

**c) checar se alguma tradução ficou faltando** — rodar no console da página servida:

```js
const IGNORAR = new Set(['VERUM','USDT','USDC','BITCOIN','Bitcoin','WhatsApp','©','2026',
  'PT','EN','ES','01','02','03','04','05','06','07','+55 11 99999-9999']);
['en','es'].forEach(lang => {
  const d = window.LP_I18N[lang], faltam = [];
  document.querySelector('.lang-btn[data-lang=pt]').click();   // volta ao PT antes de ler
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode(n) {
    if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
    const p = n.parentElement;
    if (!p || p.closest('script,style,noscript,.lang')) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT; } });
  let n; while ((n = w.nextNode())) {
    const t = n.nodeValue.trim();
    if (!IGNORAR.has(t) && !d[t] && faltam.indexOf(t) < 0) faltam.push(t);
  }
  console.log(lang, faltam.length ? faltam : 'cobertura completa');
});
```

Desde 22/11/2026 esse checker lista as strings PT do chrome do quiz (`#quiz`, `#lgpd`)
como "faltando" em EN/ES — **é esperado**: o quiz é só em PT, por decisão. Ignorar o
que vier de dentro de `.qz-overlay` ou acrescentar essas strings ao `IGNORAR`.

---

## 6. Registro de alterações

### 21/11/2026 — Hero: CTA na primeira dobra

Problema: em 1255×633 o título ocupava 4 linhas e os botões ficavam abaixo da dobra.

| Elemento | Antes | Depois |
|---|---|---|
| `.hero h1` | `clamp(38px,6.2vw,80px)`, lh .98, margem 26px | `clamp(34px,min(4.8vw,8vh),62px)`, lh 1, margem `clamp(12px,2.2vh,24px)` |
| `.hero` padding | `hdr+24px` / 64px | `hdr+clamp(6,1.6vh,24)` / `clamp(36,5vh,64)` |
| `.hero .eyebrow` | 18px | `clamp(8px,1.6vh,18px)` |
| `.lead` | 17–20px, lh 1.55 | 16–19px (teto `2.6vh`), lh 1.5 |
| `.sub` | 15px, margem 28px | `clamp(13.5px,2vh,15px)`, `clamp(14,2.6vh,28)` |
| `.assets` | padding 11px, margem 34px | `clamp(8,1.4vh,11)`, `clamp(16,3vh,34)` |
| `.hero .cta-row .btn` | 54px | `clamp(46px,7vh,54px)` |

Resultado medido em 1253×615: título em **2 linhas** (49px), botão dourado terminando
em **y=542**, ~73px de folga. Em monitor alto o título volta a 62px.

Detalhe útil: com `max-width:610px` na coluna, a linha "NÃO TEM FRONTEIRAS." mede
**11,727 × o font-size**. Ou seja, acima de ~52px ela quebra em duas linhas.

Em aberto: com o título em linha única, o final "FRONTEIRAS." avança sobre a parte
iluminada do globo (que gira). Se incomodar, a saída é um degradê escuro atrás da coluna.

### 21/11/2026 — Seção "Liberdade global": seção inteira na tela

Problema: a seção media **1122px** num viewport de 615px — botão muito abaixo da dobra.
O cliente autorizou estreitar a coluna da esquerda (globo).

| Item | Antes | Depois |
|---|---|---|
| grid | `1fr / 1.05fr`, gap 56px | `.72fr / 1.28fr`, gap `clamp(24px,3.4vw,48px)` |
| `.freedom-globe` | max 560px | max 470px |
| padding da seção | 125px (herdado de `.sec`) | `clamp(32px,5.2vh,112px)` |
| `.freedom .h2` | `clamp(28px,4.2vw,50px)` → 4 linhas | `clamp(26px,min(3.1vw,5.4vh),42px)` → 2 linhas |
| `.pillar` | padding 22px, ícone 52px, gap 14px | escalam por `vh` (até 12px / 40px / 8px) |
| `.pillar p` | 14.5px | `clamp(13px,2.3vh,14.5px)`, lh 1.5 |
| `.keys-line` | 15px, margem 22px | `clamp(13px,2.3vh,15px)`, `clamp(12px,2.2vh,22px)` |
| `.freedom .btn` | 54px | `clamp(46px,7vh,54px)` |
| novo breakpoint | — | `≤1080px e ≥901px`: grid `.56fr / 1.44fr`, gap 24px |

Resultado: **1122px → 600px**. Alturas da seção medidas por viewport:

| Viewport | Altura da seção | Cabe |
|---|---|---|
| 1253×615 | 600 | sim |
| 1253×633 | 615 | sim |
| 1366×768 | 689 | sim |
| 1440×900 | 736 | sim |
| 1920×1080 | 788 | sim |
| 1024×700 | 639 | sim |
| 950×640 | 631 | sim |
| 910×620 | 637 | botão aparece; a frase final passa 7px |

Em aberto: na faixa 901–1080px o globo fica pequeno (~240–260px). É o preço de caber;
afrouxar o `.56fr` devolve tamanho ao globo e joga a frase final ~13px abaixo da dobra.

### 21/11/2026 — Hero: +1px nos parágrafos

Pedido: aumentar em 1px a fonte dos textos do hero. Aplicado aos dois parágrafos
(`.lead` e `.sub`); título, eyebrow e pílulas de ativos ficaram como estavam.

| Elemento | Antes | Depois |
|---|---|---|
| `.lead` | `clamp(16px,min(1.5vw,2.6vh),19px)` | `clamp(17px,min(1.6vw,2.77vh),20px)` |
| `.sub` | `clamp(13.5px,2vh,15px)` | `clamp(14.5px,2.16vh,16px)` |

Os termos do meio foram reescalados junto com os limites — senão o piso sobe mas o
tamanho renderizado continua igual nos viewports intermediários. Resultado: +1px em
toda a faixa (1253×615 → lead 17 / sub 14.5; de 1366×768 para cima → lead 20 / sub 16).

A dobra continua intacta: botão dourado terminando em y=558 num viewport de 615
(era 542), ~57px de folga. Verificado também em 1253×633, 1366×768, 1440×900,
1920×1080, 1100×600 e 1024×700 — todos OK.

### 21/11/2026 — Número de WhatsApp ativado

A página já tinha todo o mecanismo pronto, só com número placeholder
(`5500000000000`). Trocado por **5545988280299** (+55 45 98828-0299) — uma linha
em cada arquivo, ver §3.

Verificado no navegador: os **9 CTAs** apontam para o número novo, nenhum ficou sem
link — header, hero, jornada, liberdade, pessoa física, empresa, contato lateral,
CTA final e o botão flutuante. O `waLink()` usado pelo envio do formulário também.
Testado com `?utm_source=teste&utm_campaign=verificacao`: a origem entra na mensagem.
Nenhum link foi clicado na verificação (abriria o WhatsApp de verdade).

### 21/11/2026 — Formulário gravando no Google Sheets

Integração via Web App do Apps Script na conta `verumpalestras@gmail.com` (ver §3).
Mudanças na página, nos dois arquivos:

- `CONFIG.formEndpoint` preenchido com a URL `/exec` e `CONFIG.formToken` adicionado.
- `Content-Type` do envio trocado de `application/json` para `text/plain;charset=UTF-8`
  (o preflight `OPTIONS` do primeiro faria a gravação falhar em silêncio).
- Novo helper `utmParams()`: `utm_source`/`utm_medium`/`utm_campaign` viram campos
  próprios no payload e alimentam a coluna "Origem".
- `interesse` passou a enviar o **texto** da opção ("Dolarizar meu patrimônio
  (USDT / USDC)") em vez do value ("dolarizar") — fica legível na planilha.

Testes feitos: POST direto ao endpoint (`HTTP 200`, resposta `{"ok":true}`) e envio
real pelo formulário em localhost (POST `200`, **sem requisição `OPTIONS`**, confirmando
que o content-type simples resolve o CORS). Linhas de teste criadas na planilha,
para apagar: "Teste manual", "TESTE INTEGRACAO - apagar", "TESTE 2 (node) - apagar",
"TESTE 3 (navegador) - apagar".

### 21/11/2026 — Coluna de consentimento + aviso de falha

**Apps Script** (`apps-script.gs`): nova coluna `Consentimento` entre "Mensagem" e
"Origem"; grava `Sim`/`Nao` a partir de `d.consentimento`.
→ Exige colar o script de novo na planilha e **Implantar → Gerenciar implantações →
Nova versão**. Como a ordem das colunas mudou, a linha de cabeçalho antiga precisa ser
apagada (junto com as linhas de teste) para o script recriar o cabeçalho com 12 colunas.

**Página** (nos dois arquivos):

- `consentimento: !!f.consentimento.checked` no payload.
- Nova função `enviarLead(lead, onFalha)`: `fetch` como caminho principal, lendo a
  resposta para confirmar `{"ok":true}`; `AbortController` com timeout de 15s;
  `sendBeacon` como última tentativa antes de avisar. O `sendBeacon` deixou de ser o
  caminho principal justamente porque não dá para saber se funcionou.
- Novo estado visual `.form-msg.is-warn` (âmbar, barra lateral) e evento
  `lead_save_error` no dataLayer.
- O `window.open` do WhatsApp continua **síncrono** com o submit — se virasse callback
  do fetch, o bloqueador de popup barraria. Há comentário no código avisando.

Testes: falha forçada com token errado → aviso apareceu, nenhuma linha gravada;
envio normal → mensagem de sucesso, só `lead_submit` no dataLayer; payload conferido
por interceptação do `fetch` (`consentimento: true`, UTMs e `interesse` com o texto
legível da opção).

### 21/11/2026 — Logo da marca, favicon e título

Logo recebido: `verum-wallet-sem-fundo-512.png` (V dourado, fundo transparente, 126 KB).

- Copiado para `assets/logo-512.png` (master) e gerados dois derivados com canvas no
  navegador, recortando a margem transparente (o V ocupava só 405×328 dos 512×512):
  **`assets/logo-128.png`** (19 KB, usado no cabeçalho e rodapé) e
  **`assets/favicon-64.png`** (6 KB). Inlinar o 512 original custaria ~170 KB no HTML;
  assim custou **+32 KB** (1249 → 1282 KB).
- Os dois `<svg>` do "V" no cabeçalho e no rodapé viraram
  `<span class="brand-mark"><span class="brand-logo"></span></span>`. A imagem entra por
  CSS (`.brand-logo{background:url(...)}`) de propósito: assim o base64 aparece **uma vez
  só** no arquivo, e não uma vez por uso. O ladrilho escuro arredondado continua igual.
- Favicon: `<link rel="icon" type="image/png">` com o PNG de 64px em data URI.
- `<title>` passou de "Verum · Assessoria Global em Ativos Digitais | USDT, USDC,
  Bitcoin e Autocustódia" para **"Assessoria Global"**.
- `build/build.mjs` atualizado: novos placeholders `__LOGO__` e `__FAVICON__`, que o
  build substitui pelos data URIs de `logo-128.png` e `favicon-64.png`.

Verificado no navegador: título "Assessoria Global", favicon carregando em 64×64,
as duas marcas renderizando a 24×24 e nenhum `<svg>` antigo sobrando.

### 21/11/2026 — Três idiomas (PT / EN / ES) com seletor no cabeçalho

**Como funciona:** o português é o original da página; `src/i18n.js` (30 KB) é um
dicionário indexado **pelo próprio texto em PT**. Não há `data-i18n` espalhado pelo
HTML — na carga, o script percorre o DOM, guarda o texto original de cada nó de texto
e de cada atributo traduzível (`placeholder`, `aria-label`, `title`, `alt`) e troca
tudo ao alternar o idioma. Por isso dá para ir e voltar entre idiomas à vontade.

Vantagem: traduzir um texto novo = acrescentar uma linha no dicionário, sem tocar no
markup. Cuidado correspondente: **se o texto em PT da página mudar, a chave quebra** e
aquele trecho volta a aparecer em português. A checagem de cobertura está abaixo.

**Alcance:** textos, atributos de acessibilidade, `<title>`, `meta description`,
atributo `lang` do `<html>`, as 6 mensagens de WhatsApp dos CTAs, as mensagens de erro
do formulário e a mensagem montada no envio. Cobertura verificada: **0 faltando** em EN
e ES (script de checagem em §5).

**Decisão importante:** o que vai para a **planilha continua sempre em PT**, mesmo com o
visitante em inglês. O `<option>` guarda o texto original em `data-pt` e é ele que é
enviado; o perfil usa o `value` do radio, que já era fixo. Assim a planilha não vira
uma mistura de idiomas. Já a mensagem de WhatsApp **vai no idioma do visitante** — ele
é quem a envia, e isso já avisa em que língua responder.

**Seleção de idioma:** `?lang=en` na URL > escolha salva em `localStorage` >
idioma do navegador > PT. A escolha fica salva; o evento `lang_switch` vai para o
dataLayer.

**Cabeçalho:** grupo `PT · EN · ES` (`.lang`) ao lado do CTA, dentro de `.hdr-right`.
Abaixo de 420px **o nome "VERUM" some e fica só o logotipo** — marca + seletor + CTA não
cabem juntos, e como o `body` tem `overflow-x:hidden` o excesso seria cortado em
silêncio (foi o que aconteceu no primeiro teste, em espanhol a 360px). Os rótulos curtos
do CTA em EN/ES são "Contact" e "Contacto", mais estreitos que o "Fale conosco".

**Dobra conferida nos três idiomas** (o texto muda de comprimento):

| Viewport | PT | EN | ES |
|---|---|---|---|
| 1253×615 | CTA y=558 · seção 600 | CTA y=515 · seção 600 | CTA y=558 · seção 600 |
| 1440×900 | CTA y=777 · seção 736 | CTA y=697 · seção 736 | CTA y=777 · seção 736 |

Cabeçalho sem estouro em 320, 360, 400, 430 e 480px nos três idiomas.

**Limitação de SEO:** a troca é no cliente, então o Google indexa só a versão em
português. i18n para busca exigiria URLs separadas (`/en/`, `/es/`) com `hreflang` —
outro patamar de trabalho, que não faz sentido antes de haver tráfego internacional.

### 22/11/2026 — Auditoria de responsividade (tablets e celulares)

**Resultado: nenhum estouro de largura.** 48 combinações testadas (16 viewports ×
3 idiomas), incluindo retrato e paisagem: 320, 360, 375, 390, 412, 430 (celulares),
667×375, 844×390, 932×430 (paisagem), 768, 820, 834, 912, 1024, 1180 (tablets).

**Como medir isso de verdade:** o `body` tem `overflow-x:hidden`, que esconde estouro —
a página *parece* ok e o conteúdo está sendo cortado. O teste só vale se desligar isso
antes de medir:

```js
d.head.insertAdjacentHTML('beforeend','<style>html,body{overflow-x:visible!important}</style>');
// depois comparar d.documentElement.scrollWidth com a largura do viewport
```

Foi assim que apareceu o botão do cabeçalho vazando 3px em espanhol a 360px (corrigido
em 21/11). Vale repetir essa checagem a cada mudança de layout.

O único elemento que ultrapassa a viewport é o `.hero-globe` (`128vw` no mobile), de
propósito — o `.hero{overflow:hidden}` corta. Confirmado que **nenhum texto é cortado**.

**Correções de usabilidade touch feitas nesta auditoria:**

- `.lang-btn` tinha **17px** de altura de toque. Agora o visual continua compacto (27px
  no celular, 31px no tablet) mas há um `::after` invisível de **44px** que estende a
  área clicável sem mexer no layout. Verificado: clique 18px acima e abaixo do centro
  ainda aciona o botão certo.
- `.ftr nav a` passou de 22px para **36px** (`padding:7px 0` + `display:inline-block`),
  com `gap` vertical de 10px para os links não se colarem ao quebrar linha.
- `.assets li` (pílulas USDT/USDC) de 10,5px para **11px** no mobile.

Radios de perfil e checkbox de consentimento têm 18px, mas estão dentro de `<label>`,
que é a área de toque real — não é problema.

**Grids:** todos colapsam para 1 coluna nos breakpoints certos (verificado em 390, 768
e 1024). Formulário, cards de público, pilares e timeline ocupam a largura toda.

**Observação, não defeito:** o botão flutuante do WhatsApp (58px, fixo no canto inferior
direito) passa por cima do conteúdo ao rolar — inerente a FAB. Se incomodar, as saídas
são reduzi-lo no mobile ou dar `padding-right` extra ao conteúdo.

---

### 22/11/2026 — Quiz conversacional substitui o formulário de contato

A captação passou a ser um **chat de qualificação em modal** com agendamento de
reunião e confirmação via WhatsApp. Detalhes de funcionamento no §3; aqui, o registro
do que mudou.

**Saiu:**

- Seção `#contato` inteira (form + coluna lateral) e todo o seu JS (`validate`,
  `buildLeadMessage`, submit handler, toggle de perfil, `window.LP.validate`).
- `aplicarCTAs()` — os `[data-cta]` não são mais reescritos para `wa.me`; um listener
  delegado abre o modal `#quiz` (inclusive o FAB e os links "Contato" do menu/rodapé,
  que apontam para `#quiz` como fallback inócuo).
- CSS do bloco `/* contato */` (`.contact-grid`, `.form`, `.field`, `.seg`, `.err`…);
  o que era útil migrou para o escopo `.qz-`.
- Evento `cta_whatsapp_click` → renomeado para `cta_click` (não abria mais WhatsApp;
  atualizar GTM/pixel se estiverem escutando o nome antigo).

**Entrou** (tudo em `src/page.html`, prefixo `.qz-`/`qz`): CSS do modal (~4 KB), HTML
dos modais `#quiz` e `#lgpd`, engine do quiz (~300 linhas), `CONFIG.meetingUrl`,
`QUIZ_AGENDA`, e no `apps-script.gs` a ramificação `tipo:'quiz'` → aba **Quiz**
(13 colunas) com `gravarQuiz`/`cabecalhoQuiz`/`testeQuiz` — caminho 'Leads' intacto.
No `i18n.js`, só "Política de Privacidade" (EN/ES).

**Decisões de desenho:** lead gravado uma única vez (no "Confirmar agendamento") —
sem salvamento parcial, para não gerar linha dupla na planilha; botão final de
WhatsApp é `<a href>` pronto no render (zero atrito com bloqueador de popup); datas
só com construtor local; fechar o modal não reseta o fluxo; avatar das bolhas reusa
a classe `.brand-logo` (o base64 do logo continua aparecendo uma vez só no arquivo —
o `sync.mjs` substitui apenas a primeira ocorrência de `__LOGO__` e aborta se sobrar).

**Verificado no navegador** (localhost, fetch interceptado — nenhum POST real):
fluxo completo nos 2 cenários (com/sem sobrenome, com/sem `meetingUrl`); máscara e
validação de WhatsApp/e-mail/nome; busca de segmento sem acento ("estetica" acha
"Estética"); calendário correto em 22/11/2026 (sábado): hoje marcado e desabilitado,
só dias úteis 23-27 e 30 clicáveis, navegação limitada ao horizonte; escassez →
"Escolher outro horário" preserva dia/mês; payload conferido campo a campo
(`tipo:'quiz'`, UTMs, consentimento, `reuniao`); eventos `quiz_*` no dataLayer na
ordem; ESC/×/clique no backdrop fecham e devolvem o foco; reabrir retoma; LGPD abre
por cima do quiz; troca PT→EN→ES com modal aberto não corrompe as bolhas; mobile por
iframe em 390×844 e 320×600 — modal fullscreen, zero overflow horizontal.

### 22/11/2026 — Evento no Google Agenda + Meet único por lead

No mesmo dia do quiz, a confirmação de agendamento passou a criar evento real na
agenda (detalhes no §3): `apps-script.gs` ganhou `criarEventoQuiz` (Calendar API
avançada, Meet exclusivo, convite ao lead, 45 min via `DURACAO_REUNIAO_MIN`,
fuso fixo `TZ_AGENDA`), a aba Quiz ganhou a 14ª coluna **Meet**, e a resposta do
`doPost` devolve `{ok:true, meet:...}`. Na página, `enviarLead` ganhou o terceiro
parâmetro `onOk`, e o card "Horário reservado!" promove o link do botão
"Ver link de acesso" para o Meet único quando a resposta chega (com `meetingUrl`
como fallback; se o lead já abriu a caixa do link, o conteúdo é atualizado).
`testeQuiz()` passou a usar e-mail vazio para não convidar endereço de terceiros.

Verificado no navegador com Apps Script simulado: sem fallback, o botão de link
não existe e **aparece sozinho** quando o Meet chega (~1-2s); com fallback e
resposta lenta, o botão aparece na hora com o link fixo e a caixa troca para o
Meet único na chegada, sem duplicar botão. Sintaxe do `.gs` validada por parse.

**Implantação e teste real (22/11/2026):** a primeira tentativa rendeu lição —
o serviço Calendar foi habilitado e autorizado no editor, mas a implantação
antiga continuava servindo versão sem o serviço (`ERRO: ReferenceError:
Calendar is not defined` na coluna Meet; o editor roda o código atual, a URL
/exec roda a versão congelada na implantação). Solução: **todas as implantações
antigas foram arquivadas** e criada uma única nova — URL nova terminando em
`...pFeslXzA/exec`, atualizada no `CONFIG.formEndpoint` e no cabeçalho do
`apps-script.gs`. POST real de validação confirmado: `{"ok":true,
"meet":"https://meet.google.com/..."}`, evento na agenda e convite recebido.
A URL antiga (`...SiS1EMmg/exec`) está morta — se aparecer em algum lugar, é sobra.

### 22/11/2026 — Publicação no GitHub Pages

Projeto versionado em **github.com/GabrielSRocha1/assessoria-lp** (público — era
privado, mas o Pages gratuito exige público; decisão do usuário ciente da exposição
do PROJETO.md e do token, que já era visível no HTML). Página no ar em
**https://gabrielsrocha1.github.io/assessoria-lp/**, Pages servindo `main` na raiz.
O `sync.mjs` passou a gerar também o `index.html` (cópia idêntica do entregável),
para a cópia publicada nunca ficar defasada. Novos na raiz: `README.md` e
`.gitignore` (`node_modules/`, `dist/`). Smoke test na URL pública: página 200 com
1339 KB, globo renderizando, quiz abrindo com as bolhas e endpoint novo embutido —
nenhum envio real feito no teste.

---

## 7. Pendências conhecidas

- ~~Reimplantar o Apps Script~~ **Feito em 22/11/2026** (implantação única nova,
  Calendar API ativa, teste real com Meet confirmado). Falta só a faxina: apagar
  da aba Quiz as linhas `TESTE QUIZ - apagar` e, da agenda de
  verumpalestras@gmail.com, os eventos de teste "Reuniao Verum - TESTE QUIZ"
  de 24/11/2026 10:00.
- **Revisar o texto da Política de Privacidade (`#lgpd`) com jurídico** — é texto
  padrão gerado em 22/11/2026, não revisado.
- `CONFIG.meetingUrl` é opcional: virou só fallback do Meet único por lead. Vale
  preencher com uma sala fixa para o raro caso de a criação do evento falhar.
- Choque de horário entre leads continua possível (grade fixa — ver §3). Evoluir
  para consulta de disponibilidade se começar a acontecer.
- Mobile validado por iframe em 48 combinações (ver §6, 22/11). Falta validação em
  aparelho real: o Chrome local não redimensiona a janela.
  Validado só por iframe: 390×844 sem overflow horizontal, grid em 1 coluna, h2 em 26px.
- Sobreposição do título do hero com a parte clara do globo (ver §6).
- Globo pequeno na faixa 901–1080px (ver §6).
- `build.mjs` precisa do ajuste de `fileURLToPath` antes do primeiro rebuild no Windows.
