/* Regenera lp-assessoria.html a partir de src/page.html SEM precisar de node_modules.
 *
 * Por que isso existe: o build oficial (build/build.mjs) precisa do esbuild e do three
 * para refazer o bundle do globo. Enquanto o globo não muda, o bundle e as texturas já
 * embutidos no lp-assessoria.html continuam válidos — este script os reaproveita e só
 * reaplica o HTML/CSS/JS vindo do src. Assim para de existir edição manual em dois lugares.
 *
 * Uso:  node build/sync.mjs
 *
 * Se um dia o globo mudar (globe.js, countries.json, texturas), aí sim é npm install +
 * node build/build.mjs — ver PROJETO.md §3.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (f) => path.join(raiz, f);
const DESTINO = p('lp-assessoria.html');

const atual = fs.readFileSync(DESTINO, 'utf8');
let page = fs.readFileSync(p('src/page.html'), 'utf8');
const i18n = fs.readFileSync(p('src/i18n.js'), 'utf8');

/* --- extrai do build atual o que não dá para regerar sem node_modules --- */
function entre(texto, inicio, fim, nome) {
  const a = texto.indexOf(inicio);
  if (a < 0) throw new Error('não encontrei o início de ' + nome);
  const b = texto.indexOf(fim, a + inicio.length);
  if (b < 0) throw new Error('não encontrei o fim de ' + nome);
  return texto.slice(a + inicio.length, b);
}

const assetsJson = entre(atual, '<script type="application/json" id="globe-assets">', '</script>', 'globe-assets');
const dataJson = entre(atual, '<script type="application/json" id="globe-data">', '</script>', 'globe-data');
const bundle = entre(atual, '<!-- motor 3D (Three.js tree-shaken) -->\n<script>\n', '\n</script>', 'bundle do globo');
const earthLo = (atual.match(/background-image:url\("(data:image\/jpeg;base64,[^"]+)"\)/) || [])[1];
if (!earthLo) throw new Error('não encontrei a textura earth-lo no CSS');

const b64 = (f, mime) => `data:${mime};base64,` + fs.readFileSync(p(f)).toString('base64');
const logo = b64('assets/logo-128.png', 'image/png');
const favicon = b64('assets/favicon-64.png', 'image/png');

/* --- aplica os placeholders (função como 2º argumento evita que $& seja interpretado) --- */
const trocas = [
  ['__FAVICON__', favicon],
  ['__LOGO__', logo],
  ['__EARTH_LO__', earthLo],
  ['__ASSETS_JSON__', assetsJson],
  ['__DATA_JSON__', dataJson],
  ['/*__GLOBE_BUNDLE__*/', bundle],
  ['/*__I18N__*/', i18n]
];
for (const [alvo, valor] of trocas) {
  if (!page.includes(alvo)) throw new Error('placeholder ausente em src/page.html: ' + alvo);
  page = page.replace(alvo, () => valor);
}
/* só os placeholders conhecidos: o bundle do Three.js tem identificadores
   como __THREE__ e __THREE_DEVTOOLS__, que não são placeholders nossos */
const sobrou = trocas.map(([alvo]) => alvo).filter((alvo) => page.includes(alvo));
if (sobrou.length) throw new Error('placeholder não substituído: ' + sobrou.join(', '));

fs.writeFileSync(DESTINO, page);
/* cópia publicada: o GitHub Pages serve index.html na raiz do repositório */
fs.writeFileSync(p('index.html'), page);
console.log(
  'lp-assessoria.html + index.html regenerados | ' +
  (atual.length / 1024).toFixed(0) + 'KB -> ' + (page.length / 1024).toFixed(0) + 'KB' +
  ' | i18n ' + (i18n.length / 1024).toFixed(1) + 'KB'
);
