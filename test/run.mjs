import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';
import fs from 'node:fs';

const URL = 'file:///home/claude/work/dist/index.html';
const HTML = fs.readFileSync('/home/claude/work/dist/index.html', 'utf8');
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '→', e.message); }
}
const ok = (c, m) => { if (!c) throw new Error(m || 'falhou'); };

async function launch(extra = []) {
  return puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--headless=new', ...extra] });
}
async function open(browser, { w = 1440, h = 900, q = '', reduced = false } = {}) {
  const page = await browser.newPage();
  page._errors = [];
  page.on('pageerror', (e) => page._errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts\.g/.test(m.text() + (m.location()?.url || ''))) page._errors.push(m.text()); });
  await page.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: w < 800 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => {
    window.__opened = [];
    window.open = (u) => { window.__opened.push(u); return {}; };
    window.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[target="_blank"]'); if (a) e.preventDefault(); });
  });
  await page.goto(URL + q);
  await page.waitForFunction(() => {
    const el = document.getElementById('globe-hero');
    return el.dataset.globeState === 'hi' || el.dataset.globeState === 'fallback';
  }, { timeout: 30000 });
  return page;
}
function pixelStats(buf) {
  const png = PNG.sync.read(buf);
  let lit = 0, blue = 0, n = png.width * png.height;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r + g + b > 60) lit++;
    if (b > r + 15 && b > 50) blue++;
  }
  return { lit: lit / n, blue: blue / n };
}

console.log('\n▸ Estrutura, SEO e conteúdo');
await t('HTML autocontido: sem <script src> e sem CSS externo além do Google Fonts', () => {
  ok(!/<script[^>]+src=/i.test(HTML), 'script externo');
  const links = [...HTML.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  ok(links.every((h) => /fonts\.(googleapis|gstatic)\.com/.test(h)), 'link externo: ' + links.join(','));
});
await t('SEO: lang pt-BR, title, meta description, OG e JSON-LD válido', () => {
  ok(/<html lang="pt-BR">/.test(HTML));
  ok(/<title>[^<]{20,}<\/title>/.test(HTML));
  ok(/<meta name="description" content="[^"]{80,}"/.test(HTML));
  ok(/property="og:title"/.test(HTML));
  const ld = HTML.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  ok(JSON.parse(ld)['@type'] === 'ProfessionalService');
});
await t('Textos obrigatórios presentes', () => {
  const plain = HTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  [
    'SEU PATRIMÔNIO NÃO TEM FRONTEIRAS.',
    'DOLARIZE SEU PATRIMÔNIO, APRENDA A MANTER SEUS ATIVOS EM AUTOCUSTÓDIA',
    'INDEPENDENTEMENTE DO VOLUME DE PATRIMÔNIO',
    'UMA NOVA DIMENSÃO DE LIBERDADE FINANCEIRA.',
    'LIBERDADE GLOBAL NÃO É APENAS PODER VIAJAR. É TER CONHECIMENTO, CONTROLE E AUTONOMIA SOBRE COMO ADMINISTRAR SEU PATRIMÔNIO.',
    'SEU PATRIMÔNIO DIGITAL. SUAS PRÓPRIAS CHAVES. UM MUNDO DE POSSIBILIDADES.',
    'SEU DINHEIRO NÃO PRECISA FICAR PRESO A UMA FRONTEIRA. CONHEÇA A LIBERDADE DA ECONOMIA DIGITAL.',
    'NÃO IMPORTA SE VOCÊ É UMA PESSOA FÍSICA, EMPRESÁRIO OU REPRESENTA UMA EMPRESA.',
    'DOLARIZAÇÃO DIGITAL', 'AUTOCUSTÓDIA', 'LIQUIDEZ GLOBAL', 'CARTÃO GLOBAL',
    'QUERO MINHA ASSESSORIA PERSONALIZADA', 'DESCUBRA COMO FUNCIONA', 'QUERO DOLARIZAR MEU PATRIMÔNIO',
    'QUERO APRENDER AUTOCUSTÓDIA', 'QUERO UMA ASSESSORIA PARA MINHA EMPRESA', 'FALAR COM UM ESPECIALISTA'
  ].forEach((s) => ok(plain.includes(s), 'faltando: ' + s));
});
await t('Sem promessas proibidas nem valor mínimo', () => {
  const plain = HTML.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').toLowerCase();
  ['garantid', '100% segur', 'segurança absoluta', 'sem risco', 'ininterrupt', 'totalmente seguro', 'mínimo de r$', 'a partir de r$']
    .forEach((w) => ok(!plain.includes(w), 'contém: ' + w));
});
await t('Uma única <h1>', () => ok((HTML.match(/<h1[\s>]/g) || []).length === 1));

const b = await launch(GL);
console.log('\n▸ Globo 3D (desktop, WebGL)');
let page = await open(b, { q: '?globe=high' });
await t('Sem erros de JavaScript', () => ok(page._errors.length === 0, page._errors.join(' | ')));
await t('Globo do hero renderizado com textura HD, nuvens e bandeiras', async () => {
  const s = await page.evaluate(() => window.LP.globes['globe-hero'].state);
  ok(s.webgl && s.lo && s.hi && s.flags, JSON.stringify(s));
  ok(s.flagCount === 33, 'bandeiras: ' + s.flagCount);
  ok(s.tier === 'high');
});
await t('Pixels do globo: área iluminada e predominância azul oceano', async () => {
  await sleep(800);
  const el = await page.$('#globe-hero');
  const box = await el.boundingBox();
  const buf = await page.screenshot({ clip: { x: box.x + box.width * 0.3, y: Math.max(0, box.y + box.height * 0.3), width: box.width * 0.35, height: box.height * 0.35 } });
  const st = pixelStats(buf);
  ok(st.lit > 0.7, 'lit ' + st.lit.toFixed(2));
  ok(st.blue > 0.25, 'blue ' + st.blue.toFixed(2));
});
await t('Rotação contínua', async () => {
  const r0 = await page.evaluate(() => window.LP.globes['globe-hero'].rotation);
  await sleep(1200);
  const r1 = await page.evaluate(() => window.LP.globes['globe-hero'].rotation);
  ok(r1 - r0 > 0.02, 'delta ' + (r1 - r0));
});
await t('Arrastar com o mouse gira o globo', async () => {
  const g = () => page.evaluate(() => window.LP.globes['globe-hero'].rotation);
  const box = await (await page.$('#globe-hero canvas')).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const r0 = await g();
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + i * 30, cy);
  await page.mouse.up();
  const r1 = await g();
  ok(r1 - r0 > 0.5, 'delta ' + (r1 - r0));
});
await t('Posição geográfica: spinForLon leva a longitude ao centro da câmera', async () => {
  const z = await page.evaluate(() => {
    const V = window.VerumGlobe; const out = [];
    for (const [lat, lon] of [[-23.55, -46.63], [51.51, -0.13], [35.68, 139.69]]) {
      const v = V.latLonToVec3(0, lon, 1); const a = V.spinForLon(lon);
      out.push(-v.x * Math.sin(a) + v.z * Math.cos(a));
    }
    return out;
  });
  z.forEach((v) => ok(Math.abs(v - 1) < 1e-9, 'z=' + v));
});
await t('Pausa quando o hero sai da tela (economia de bateria)', async () => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(700);
  ok(!(await page.evaluate(() => window.LP.globes['globe-hero'].running)));
});
await t('Globo da seção Liberdade Global carregado sob demanda (compacto)', async () => {
  const p0 = await open(b, { q: '?globe=high' });
  const before = await p0.evaluate(() => !!window.LP.globes['globe-freedom']);
  await p0.close();
  ok(!before, 'montado cedo demais');
  await page.evaluate(() => document.getElementById('liberdade').scrollIntoView());
  await page.waitForFunction(() => window.LP.globes['globe-freedom'] && window.LP.globes['globe-freedom'].state.flags, { timeout: 60000 });
  const s = await page.evaluate(() => window.LP.globes['globe-freedom'].state);
  ok(s.flagCount === 16, 'bandeiras compactas: ' + s.flagCount);
});

console.log('\n▸ Conversão e rastreamento');
page = await open(b);
await t('Todos os CTAs com data-cta apontam para wa.me com mensagem específica', async () => {
  const r = await page.evaluate(() => [...document.querySelectorAll('[data-cta]')].map((a) => ({ k: a.dataset.cta, h: a.href, t: a.target })));
  ok(r.length >= 9, 'qtd ' + r.length);
  const MSG = await page.evaluate(() => window.LP.MSG);
  r.forEach((x) => {
    ok(x.h.startsWith('https://wa.me/'), x.k + ' ' + x.h);
    ok(decodeURIComponent(x.h.split('text=')[1]).startsWith(MSG[x.k]), 'msg ' + x.k);
    ok(x.t === '_blank');
  });
});
await t('Os 4 CTAs exigidos direcionam ao atendimento correto', async () => {
  const map = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('a.btn')].map((a) => [a.textContent.trim().toUpperCase().replace(/\s+/g, ' '), a.dataset.cta || a.getAttribute('href')])));
  ok(map['QUERO DOLARIZAR MEU PATRIMÔNIO'] === 'dolarizar');
  ok(map['QUERO APRENDER AUTOCUSTÓDIA'] === 'autocustodia');
  ok(map['QUERO UMA ASSESSORIA PARA MINHA EMPRESA'] === 'empresa');
  ok(map['FALAR COM UM ESPECIALISTA'] === 'especialista');
  ok(map['QUERO MINHA ASSESSORIA PERSONALIZADA'] === 'assessoria');
  ok(map['DESCUBRA COMO FUNCIONA'] === '#como-funciona');
});
await t('Âncoras internas apontam para seções existentes', async () => {
  const missing = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.querySelector(h)));
  ok(missing.length === 0, missing.join(','));
});
await t('Clique em CTA envia evento ao dataLayer', async () => {
  await page.click('[data-cta="empresa"]');
  const ev = await page.evaluate(() => window.dataLayer.filter((e) => e.event === 'cta_whatsapp_click'));
  ok(ev.length === 1 && ev[0].cta === 'empresa' && ev[0].posicao === 'empresa', JSON.stringify(ev));
});
await t('UTM da URL é anexada à mensagem do WhatsApp', async () => {
  const p2 = await open(b, { q: '?utm_source=instagram&utm_campaign=globo' });
  const h = await p2.evaluate(() => document.querySelector('[data-cta="dolarizar"]').href);
  ok(decodeURIComponent(h).includes('[origem: source=instagram · campaign=globo]'), h);
  await p2.close();
});
await t('Formulário: bloqueia envio inválido e mostra erros', async () => {
  await page.evaluate(() => document.querySelector('#lead-form button[type=submit]').click());
  const r = await page.evaluate(() => ({ e1: document.getElementById('e-nome').textContent, e2: document.getElementById('e-whats').textContent, e3: document.getElementById('e-consent').textContent, opened: window.__opened.length }));
  ok(r.e1 && r.e2 && r.e3 && r.opened === 0, JSON.stringify(r));
});
await t('Formulário: perfil Empresa exibe campo empresa e ajusta interesse', async () => {
  const before = await page.$eval('#wrap-empresa', (e) => getComputedStyle(e).display);
  await page.evaluate(() => { const r = document.querySelector('input[name=perfil][value=Empresa]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
  const after = await page.$eval('#wrap-empresa', (e) => getComputedStyle(e).display);
  const sel = await page.$eval('#f-interesse', (e) => e.value);
  ok(before === 'none' && after !== 'none' && sel === 'empresa', before + '/' + after + '/' + sel);
});
await t('Formulário válido abre WhatsApp com todos os dados e registra lead', async () => {
  await page.type('#f-nome', 'Maria Souza');
  await page.type('#f-whats', '+55 11 98888-7777');
  await page.type('#f-empresa', 'Souza Importações');
  await page.type('#f-email', 'maria@exemplo.com');
  await page.type('#f-msg', 'Quero estruturar tesouraria em USDC.');
  await page.evaluate(() => { document.getElementById('f-consent').checked = true; document.querySelector('#lead-form button[type=submit]').click(); });
  const r = await page.evaluate(() => ({ url: window.__opened[0], ev: window.dataLayer.some((e) => e.event === 'lead_submit'), msg: document.getElementById('form-msg').textContent }));
  const txt = decodeURIComponent(r.url.split('text=')[1]);
  ['Maria Souza', 'Empresa', 'Souza Importações', '98888-7777', 'maria@exemplo.com', 'Tesouraria digital', 'USDC'].forEach((s) => ok(txt.includes(s), 'faltou ' + s));
  ok(r.url.startsWith('https://wa.me/') && r.ev && r.msg, JSON.stringify(r));
});

console.log('\n▸ Mobile');
page = await open(b, { w: 390, h: 844 });
await t('Sem rolagem horizontal em 390px', async () => {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  ok(r.sw <= r.iw, JSON.stringify(r));
});
await t('Globo no topo e visível na primeira dobra, com rolagem vertical preservada (touch-action pan-y)', async () => {
  const r = await page.evaluate(() => {
    const c = document.querySelector('#globe-hero canvas'); const b = c.getBoundingClientRect();
    return { top: b.top, h: b.height, ta: c.style.touchAction, tier: window.LP.globes['globe-hero'].state.tier };
  });
  ok(r.top < 120 && r.h > 300 && r.ta === 'pan-y', JSON.stringify(r));
});
await t('Título visível na primeira dobra do celular', async () => {
  const y = await page.$eval('#hero-title', (e) => e.getBoundingClientRect().top);
  ok(y < 844 * 0.9, 'top ' + y);
});
await page.close();

console.log('\n▸ Acessibilidade de movimento e fallback');
page = await open(b, { reduced: true });
await t('prefers-reduced-motion: globo estático (sem loop contínuo), mas renderizado', async () => {
  const g = () => page.evaluate(() => ({ r: window.LP.globes['globe-hero'].rotation, run: window.LP.globes['globe-hero'].running, f: window.LP.globes['globe-hero'].state.frames }));
  const a = await g(); await sleep(1200); const c = await g();
  ok(!a.run && a.r === c.r && c.f > 0, JSON.stringify([a, c]));
});
await t('prefers-reduced-motion: conteúdo visível sem animação de entrada', async () => {
  const op = await page.$eval('.journey li', (e) => getComputedStyle(e).opacity);
  ok(op === '1', op);
});
await page.close();
await b.close();

const nb = await launch(['--disable-webgl', '--disable-3d-apis']);
page = await open(nb);
await t('Sem WebGL: fallback visual do globo é exibido, sem erros', async () => {
  const r = await page.evaluate(() => {
    const el = document.getElementById('globe-hero'); const fb = el.querySelector('.globe-fallback');
    return { cls: el.classList.contains('is-fallback'), st: el.dataset.globeState, op: getComputedStyle(fb).opacity, bg: getComputedStyle(fb).backgroundImage.slice(0, 20), canvas: !!el.querySelector('canvas') };
  });
  ok(r.cls && r.st === 'fallback' && r.op === '1' && r.bg.startsWith('url("data:image') && !r.canvas, JSON.stringify(r));
  ok(page._errors.length === 0, page._errors.join('|'));
});
await t('Sem WebGL: CTAs continuam funcionando', async () => {
  const h = await page.$eval('[data-cta="assessoria"]', (a) => a.href);
  ok(h.startsWith('https://wa.me/'));
});
await nb.close();

console.log(`\n${pass} aprovados, ${fail} falharam (${pass + fail} testes)`);
process.exit(fail ? 1 : 0);
