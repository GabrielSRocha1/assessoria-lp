// Gera o atlas de bandeiras (PNG 1024x1024, células 128px) a partir dos SVGs de country-flag-icons.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/countries.json'), 'utf8'));
const flags = data.countries.map((c) => ({
  iso3: c.iso3,
  svg: fs.readFileSync(path.join(root, 'node_modules/country-flag-icons/3x2', c.iso2 + '.svg'), 'utf8')
}));

const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--headless=new'] });
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="1024" height="1024"></canvas>');
const dataUrl = await page.evaluate(async (flags) => {
  const C = 128, cols = 8;
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const load = (svg) => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = rej;
    i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  for (let k = 0; k < flags.length; k++) {
    const x0 = (k % cols) * C, y0 = Math.floor(k / cols) * C;
    const img = await load(flags[k].svg);
    const fx = x0 + 3, fy = y0 + 4, fw = 99, fh = 66;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    rr(fx, fy, fw, fh, 4); ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();
    ctx.save();
    rr(fx, fy, fw, fh, 4); ctx.clip();
    ctx.drawImage(img, fx, fy, fw, fh);
    // leve ondulação/brilho de tecido
    const g = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
    g.addColorStop(0, 'rgba(255,255,255,0.20)');
    g.addColorStop(0.35, 'rgba(255,255,255,0)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.10)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g; ctx.fillRect(fx, fy, fw, fh);
    ctx.restore();
    rr(fx + 0.5, fy + 0.5, fw - 1, fh - 1, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    // código do país
    ctx.font = '700 23px "DejaVu Sans", Arial, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(3,8,16,0.85)'; ctx.lineWidth = 5;
    ctx.strokeText(flags[k].iso3, x0 + 4, y0 + 98);
    ctx.fillStyle = '#f6efe0';
    ctx.fillText(flags[k].iso3, x0 + 4, y0 + 98);
  }
  return cv.toDataURL('image/png');
}, flags);
await browser.close();
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets/atlas.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('atlas ok', flags.length, 'bandeiras');
