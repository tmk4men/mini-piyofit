// 本番ビルドを URL の 下で 通しで あそぶ（状態の 注入なし）。読み込み失敗を ぜんぶ 集める
// URL=https://.../mini-piyofit/ node verify/prod.cjs
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TARGET = process.env.URL || 'http://localhost:5190/mini-piyofit/';

(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const logs = [];
  const loaded = new Set();
  p.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  p.on('console', (m) => m.type() === 'error' && logs.push('console ' + m.text()));
  p.on('requestfailed', (r) => logs.push('failed ' + r.url()));
  p.on('response', (r) => {
    if (r.status() >= 400) logs.push(`http ${r.status()} ${r.url()}`);
    else loaded.add(new URL(r.url()).pathname.split('/').pop());
  });
  const click = async (t) => {
    const ok = await p.evaluate((t) => {
      const el = [...document.querySelectorAll('button,.place,.good')].find((e) => (e.innerText || e.getAttribute('aria-label') || '').includes(t));
      if (el) el.click();
      return !!el;
    }, t);
    if (!ok) logs.push('click-miss ' + t);
    await sleep(500);
  };

  await p.goto(TARGET, { waitUntil: 'networkidle2' });
  await sleep(800);
  await p.screenshot({ path: 'shots/prod-1-help.png' });
  await click('はじめる');
  await sleep(11500);
  await p.screenshot({ path: 'shots/prod-1b-after11s.png' });
  console.log('11.5s', await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.innerText || b.getAttribute('aria-label')).join('|')));
  await click('やったね');
  await p.type('.name-input', 'ぴよすけ');
  await click('これにする');
  await click('なでる');
  await p.screenshot({ path: 'shots/prod-2-home.png' });
  await click('ごはん');
  await click('おにぎり');
  await click('もどる');
  await click('おみせ');
  await p.screenshot({ path: 'shots/prod-3-shop.png' });
  await click('もどる');
  await click('おでかけ');
  await click('おじいちゃん');
  await p.screenshot({ path: 'shots/prod-4-grandpa.png' });
  await click('かえる');
  await click('はらっぱ');
  const stage = await p.$('.run-stage');
  const box = await stage.boundingBox();
  await p.mouse.click(box.x + 50, box.y + 50);
  await sleep(1200);
  await p.screenshot({ path: 'shots/prod-5-run.png' });
  await p.waitForSelector('.run-cover.is-end', { timeout: 15000 });
  await click('かえる');
  await click('うんどう');
  await sleep(5000);
  const cam = await p.evaluate(() => ({ video: !!document.querySelector('video')?.srcObject, phase: document.querySelector('.ex-phase')?.innerText, msg: document.querySelector('.ex-msg')?.innerText }));
  await p.screenshot({ path: 'shots/prod-6-ex.png' });
  await click('おわる');
  const sw = await p.evaluate(async () => (await navigator.serviceWorker?.getRegistration())?.scope ?? null);

  const need = ['room.webp', 'piyo.webp', 'piyo_egg.webp', 'grandpa_house.webp', 'play-bg.webp', 'new-bgm.mp3', 'pose_landmarker_lite.task', 'manifest.webmanifest'];
  console.log('camera', JSON.stringify(cam));
  console.log('sw scope', sw);
  console.log('読めた主な素材', need.map((n) => `${n}:${loaded.has(n) ? 'ok' : 'NG'}`).join(' '));
  console.log('LOGS', logs.length ? '\n' + logs.join('\n') : 'none');
  await b.close();
})();
