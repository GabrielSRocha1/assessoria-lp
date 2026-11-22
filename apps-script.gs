/* ===========================================================
   Verum - LP Assessoria Global
   Recebe os leads da landing page e grava na planilha.
   - Payload com tipo:'quiz'  -> aba "Quiz" (quiz conversacional, 14 colunas)
     + cria evento de 45 min no Google Agenda da conta, com link de Meet
       exclusivo, e convida o lead pelo e-mail informado. O link volta na
       resposta ({ok:true, meet:...}) e a pagina mostra ao lead.
   - Qualquer outro payload   -> aba "Leads" (caminho original, intacto)

   Instalacao (conta verumpalestras@gmail.com):
   1. Na planilha: Extensoes > Apps Script
   2. Apagar tudo, colar este arquivo inteiro, salvar
   3. Trocar o TOKEN abaixo por uma senha sua
   4. OBRIGATORIO para o evento/Meet: no menu lateral do editor,
      Servicos (+) > Google Calendar API > Adicionar (identificador "Calendar").
      Sem isso o lead continua sendo gravado, mas a coluna Meet registra o erro.
   5. Rodar a funcao "teste" uma vez (autoriza o script e cria o cabecalho)
   6. Implantar > Nova implantacao > App da Web
        Executar como: Eu
        Quem pode acessar: Qualquer pessoa
   7. Copiar a URL que termina em /exec e me enviar junto com o token

   Obs: ao editar este script depois, e preciso
   Implantar > Gerenciar implantacoes > editar > Versao: Nova versao.
   Apenas salvar nao atualiza o que esta no ar.

   IMPLANTACAO ATIVA (22/11/2026, unica - as anteriores foram arquivadas):
   https://script.google.com/macros/s/AKfycbyyW07byZFFtg7CZULa6BO_zpRzBUUBUhY_K733DZamogfJnxtFihmi2LAsldpFeslXzA/exec
   =========================================================== */

var TOKEN = 'assessoria-verum-2026';
var TAB = 'Leads';
var TZ_AGENDA = 'America/Sao_Paulo';
var DURACAO_REUNIAO_MIN = 45;

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) { return resp({ ok: false, erro: 'token invalido' }); }
    var ss = SpreadsheetApp.getActive();
    if (d.tipo === 'quiz') { return gravarQuiz(ss, d); }
    var sh = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
    if (sh.getLastRow() === 0) { cabecalho(sh); }
    var origem = [d.utm_source, d.utm_medium, d.utm_campaign].filter(String).join(' / ');
    var consent = (d.consentimento === true || d.consentimento === 'Sim') ? 'Sim' : 'Nao';
    var linha = [new Date(), d.perfil, d.nome, d.whatsapp, d.email, d.empresa, d.pais, d.interesse, d.mensagem, consent, origem, d.pagina];
    sh.appendRow(linha.map(limpar));
    return resp({ ok: true });
  } catch (err) {
    return resp({ ok: false, erro: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* Leads do quiz conversacional (aba propria, colunas proprias).
   Chamada ja dentro do lock e com token validado pelo doPost.
   A falha na criacao do evento NUNCA impede a gravacao da linha:
   o erro fica registrado na coluna Meet para diagnostico. */
function gravarQuiz(ss, d) {
  var sh = ss.getSheetByName('Quiz') || ss.insertSheet('Quiz');
  if (sh.getLastRow() === 0) { cabecalhoQuiz(sh); }
  var origem = [d.utm_source, d.utm_medium, d.utm_campaign].filter(String).join(' / ');
  var consent = (d.consentimento === true || d.consentimento === 'Sim') ? 'Sim' : 'Nao';
  var meet = '';
  try { meet = criarEventoQuiz(d, origem); } catch (err) { meet = 'ERRO: ' + err; }
  var linha = [new Date(), d.nome, d.sobrenome, d.whatsapp, d.empresa, d.segmento, d.cargo, d.faturamento, d.email, d.reuniao, consent, origem, d.pagina, meet];
  sh.appendRow(linha.map(limpar));
  return resp({ ok: true, meet: String(meet).indexOf('http') === 0 ? meet : '' });
}

/* Cria o evento no Google Agenda da conta (45 min) com link de Meet exclusivo
   e convida o lead por e-mail (o Google envia o convite e os lembretes).
   Requer o servico avancado "Google Calendar API" (passo 4 da instalacao).
   Horario montado como texto + timeZone fixo: nao depende do fuso do servidor. */
function criarEventoQuiz(d, origem) {
  var m = String(d.reuniao || '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!m) { return ''; }
  var dia = m[3] + '-' + m[2] + '-' + m[1];
  var fimMin = (+m[4]) * 60 + (+m[5]) + DURACAO_REUNIAO_MIN;
  var evento = {
    summary: 'Reuniao Verum - ' + d.nome + (d.empresa ? ' (' + d.empresa + ')' : ''),
    description: 'Lead do quiz da landing page\n'
      + 'Nome: ' + ((d.nome || '') + ' ' + (d.sobrenome || '')).trim() + '\n'
      + 'WhatsApp: ' + (d.whatsapp || '') + '\n'
      + 'E-mail: ' + (d.email || '') + '\n'
      + 'Empresa: ' + (d.empresa || '') + '\n'
      + 'Segmento: ' + (d.segmento || '') + '\n'
      + 'Cargo: ' + (d.cargo || '') + '\n'
      + 'Faturamento: ' + (d.faturamento || '')
      + (origem ? '\nOrigem: ' + origem : ''),
    start: { dateTime: dia + 'T' + m[4] + ':' + m[5] + ':00', timeZone: TZ_AGENDA },
    end: { dateTime: dia + 'T' + dois(Math.floor(fimMin / 60)) + ':' + dois(fimMin % 60) + ':00', timeZone: TZ_AGENDA },
    conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
  };
  if (d.email) { evento.attendees = [{ email: d.email }]; }
  var criado = Calendar.Events.insert(evento, 'primary', { conferenceDataVersion: 1, sendUpdates: 'all' });
  return criado.hangoutLink || '';
}

function dois(n) {
  return (n < 10 ? '0' : '') + n;
}

function limpar(v) {
  return (v === null || v === undefined) ? '' : v;
}

function cabecalho(sh) {
  var cab = ['Data', 'Perfil', 'Nome', 'WhatsApp', 'E-mail', 'Empresa', 'Pais', 'Interesse', 'Mensagem', 'Consentimento', 'Origem', 'Pagina'];
  sh.appendRow(cab);
  sh.setFrozenRows(1);
}

function cabecalhoQuiz(sh) {
  var cab = ['Data', 'Nome', 'Sobrenome', 'WhatsApp', 'Empresa', 'Segmento', 'Cargo', 'Faturamento', 'E-mail', 'Reuniao', 'Consentimento', 'Origem', 'Pagina', 'Meet'];
  sh.appendRow(cab);
  sh.setFrozenRows(1);
}

/* Roda direto no editor (botao Executar) para testar sem a landing page.
   Deve criar o cabecalho e uma linha "Teste manual" na planilha. */
function teste() {
  var payload = {
    token: TOKEN,
    perfil: 'Pessoa fisica',
    nome: 'Teste manual',
    whatsapp: '45988280299',
    email: 'teste@exemplo.com',
    empresa: '',
    pais: 'Brasil',
    interesse: 'Dolarizar meu patrimonio (USDT / USDC)',
    mensagem: 'Linha de teste gerada pelo editor do Apps Script.',
    consentimento: true,
    utm_source: 'teste',
    pagina: 'https://exemplo.com/?utm_source=teste'
  };
  var fake = { postData: { contents: JSON.stringify(payload) } };
  Logger.log(doPost(fake).getContent());
}

/* Mesmo esquema do teste(), para a aba Quiz.
   ATENCAO: cria um evento REAL na agenda (com Meet) — apagar o evento de
   teste junto com a linha da planilha. O e-mail vai vazio de proposito,
   para o teste nao enviar convite a um endereco de terceiros. */
function testeQuiz() {
  var payload = {
    token: TOKEN,
    tipo: 'quiz',
    nome: 'TESTE QUIZ - apagar',
    sobrenome: 'Manual',
    whatsapp: '45988280299',
    empresa: 'Empresa Teste',
    segmento: 'Consultoria',
    cargo: 'Socio ou Fundador',
    faturamento: 'R$ 60 mil a R$ 250 mil',
    email: '',
    reuniao: '24/11/2026 10:00',
    consentimento: true,
    utm_source: 'teste',
    pagina: 'https://exemplo.com/?utm_source=teste'
  };
  var fake = { postData: { contents: JSON.stringify(payload) } };
  Logger.log(doPost(fake).getContent());
}

function resp(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
