import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const r = (p) => path.join(root, p);
const res = await build({ entryPoints: [r('src/entry.js')], bundle: true, minify: true, format: 'iife', target: ['es2019'], write: false, legalComments: 'none' });
let js = res.outputFiles[0].text;
if (/<\/script/i.test(js)) js = js.replace(/<\/script/gi, '<\\/script');
const b64 = (f, mime) => `data:${mime};base64,` + fs.readFileSync(r(f)).toString('base64');
const assets = {
  earthLo: b64('assets/earth-lo.jpg', 'image/jpeg'),
  earthHi: b64('assets/earth-2k.jpg', 'image/jpeg'),
  bump: b64('assets/bump.jpg', 'image/jpeg'),
  water: b64('assets/water.jpg', 'image/jpeg'),
  clouds: b64('assets/clouds.jpg', 'image/jpeg'),
  atlas: b64('assets/atlas-q.png', 'image/png'),
  logo: b64('assets/logo-128.png', 'image/png'),
  favicon: b64('assets/favicon-64.png', 'image/png')
};
const data = JSON.parse(fs.readFileSync(r('src/countries.json'), 'utf8'));
data.atlas = { cols: 8, rows: 8 };
let html = fs.readFileSync(r('src/page.html'), 'utf8');
const three = 'Three.js r' + JSON.parse(fs.readFileSync(r('node_modules/three/package.json'))).version + ' (MIT) — texturas NASA Blue Marble (domínio público) — bandeiras country-flag-icons (MIT)';
html = html
  .replace('__EARTH_LO__', assets.earthLo)
  .replace('__LOGO__', () => assets.logo)
  .replace('__FAVICON__', () => assets.favicon)
  .replace('__ASSETS_JSON__', () => JSON.stringify(assets))
  .replace('__DATA_JSON__', () => JSON.stringify(data))
  .replace('/*__GLOBE_BUNDLE__*/', () => `/* ${three} */\n` + js);
fs.mkdirSync(r('dist'), { recursive: true });
fs.writeFileSync(r('dist/index.html'), html);
console.log('bundle JS:', (js.length / 1024).toFixed(1), 'KB | HTML total:', (html.length / 1024).toFixed(1), 'KB');
