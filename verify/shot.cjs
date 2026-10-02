// 使い方: node shot.cjs <出力名> [操作JSON]
// 初回起動から順に画面を撮り、console error / pageerror / requestfailed を集める
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5181/';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^\d\d-.*\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: process.env.RM || 'no-preference' }]);
  const [VW, VH] = (process.env.VIEW || '390x844').split('x').map(Number);
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2, isMobile: VW < 700, hasTouch: VW < 700 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  page.on('requestfailed', r => logs.push('requestfailed: ' + r.url()));

  const steps = JSON.parse(process.argv[2] || '[]');
  await page.goto(URL, { waitUntil: 'networkidle2' });
  if (process.env.FRESH) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
  }
  await new Promise(r => setTimeout(r, 1500));
  let n = 0;
  const snap = async (name) => {
    const f = path.join(OUT, `${String(n++).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: f });
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => (b.innerText || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    console.log(f, '\n  buttons:', JSON.stringify(texts));
  };
  await snap('start');
  for (const s of steps) {
    if (s.click) {
      const ok = await page.evaluate((t) => {
        const els = [...document.querySelectorAll('button,[role=button],a')].filter(e => e.offsetParent);
        const el = els.find(e => (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').includes(t));
        if (el) { el.click(); return true; } return false;
      }, s.click);
      if (!ok) logs.push('click-miss: ' + s.click);
    }
    if (s.tap) { for (let i = 0; i < s.tap.n; i++) { await page.click(s.tap.sel); await new Promise(r => setTimeout(r, 60)); } }
    if (s.type) { await page.keyboard.type(s.type); }
    if (s.eval) { console.log('  eval:', JSON.stringify(await page.evaluate(s.eval))); }
    await new Promise(r => setTimeout(r, s.wait || 800));
    if (s.shot) await snap(s.shot);
  }
  console.log('LOGS:', logs.length ? '\n' + logs.join('\n') : 'none');
  await browser.close();
})();
