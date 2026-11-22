import puppeteer from 'puppeteer-core';
const [,, w, h, out, q=''] = process.argv;
const browser = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', args:['--no-sandbox','--headless=new','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width:+w, height:+h, deviceScaleFactor:1, isMobile:+w<800, hasTouch:+w<800 });
await page.goto('file:///home/claude/work/dist/index.html'+q);
await new Promise(r=>setTimeout(r,3500));
// percorre para disparar reveals e o globo lazy
const H = await page.evaluate(()=>document.body.scrollHeight);
for(let y=0;y<H;y+=+h/2){ await page.evaluate(y=>window.scrollTo(0,y),y); await new Promise(r=>setTimeout(r,250)); }
await page.evaluate(()=>{ document.querySelectorAll('.rv').forEach(e=>e.classList.add('in')); });
await page.evaluate(()=>document.getElementById('liberdade').scrollIntoView()); await new Promise(r=>setTimeout(r,3500));
await page.evaluate(()=>window.scrollTo(0,0)); await new Promise(r=>setTimeout(r,1500));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
