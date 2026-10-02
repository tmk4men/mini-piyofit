const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const logs = [];
  p.on('pageerror', (e) => logs.push(e.message));
  await p.goto('https://tmk4men.github.io/mini-piyofit/?v=' + Date.now(), { waitUntil: 'networkidle2' });
  const click = (t) => p.evaluate((t) => [...document.querySelectorAll('button')].find((e) => (e.innerText || '').includes(t))?.click(), t);
  await click('はじめる'); await sleep(11500);
  await click('やったね'); await sleep(300); await click('これにする');
  const xs = [];
  for (let i = 0; i < 40; i++) {
    xs.push(await p.evaluate(() => { const el = document.querySelector('.pet'); const a = el.parentElement.getBoundingClientRect(); const r = el.getBoundingClientRect(); return Math.round(((r.left + r.width / 2 - a.left) / a.width) * 100); }));
    await sleep(250);
  }
  console.log('公開URLの x:', Math.min(...xs), '〜', Math.max(...xs), 'errors', logs.length);
  await b.close();
})();
