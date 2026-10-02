// カメラ拒否時の表示と、障害物ゲームの速さ（フレームレート非依存）を確かめる
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(b, { denyCamera, fps } = {}) {
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const logs = [];
  p.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  p.on('console', (m) => m.type() === 'error' && logs.push('console ' + m.text()));
  await p.evaluateOnNewDocument((deny, fps) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
    }
    if (deny) {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    }
    // 端末の リフレッシュレートを まねる（rAF を 指定 fps で 呼ぶ）
    if (fps) {
      const raf = window.requestAnimationFrame.bind(window);
      let last = 0;
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), Math.max(0, 1000 / fps - (performance.now() - last))) && (last = performance.now());
      void raf;
    }
  }, !!denyCamera, fps || 0);
  await p.goto('http://localhost:5181/');
  await sleep(800);
  await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => e.innerText.includes('はじめる'))?.click());
  await sleep(200);
  await p.evaluate(() => {
    const g = window.__mini;
    const s = g.getState();
    g.setState({ overlays: [], pet: { ...s.pet, hatchedAt: Date.now(), bornAt: Date.now(), name: 'ぴよすけ' } });
  });
  await sleep(300);
  return { p, logs };
}

const click = (p, text) =>
  p.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((e) => (e.innerText || e.getAttribute('aria-label') || '').includes(t));
    if (el) el.click();
    return !!el;
  }, text);

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });

  // 1) カメラ拒否
  {
    const { p, logs } = await page(b, { denyCamera: true });
    await click(p, 'うんどう');
    await sleep(2500);
    await p.screenshot({ path: 'shots/cam-denied.png' });
    const txt = await p.evaluate(() => document.querySelector('.ex-msg')?.innerText);
    const btns = await p.evaluate(() => [...document.querySelectorAll('.toy-buttons button')].map((b) => b.getAttribute('aria-label')));
    console.log('denied:', JSON.stringify(txt), 'buttons:', JSON.stringify(btns), 'errors:', logs.length);
    await p.close();
  }

  // 2) カメラ許可（偽カメラ）
  {
    const { p, logs } = await page(b, {});
    await click(p, 'うんどう');
    await sleep(5000);
    const st = await p.evaluate(() => ({ video: !!document.querySelector('video')?.srcObject, phase: document.querySelector('.ex-phase')?.innerText }));
    await p.screenshot({ path: 'shots/cam-ready.png' });
    console.log('camera:', JSON.stringify(st), 'errors:', logs.length ? logs : 0);
    await p.close();
  }

  // 3) はらっぱ：30/60/120fps で 最初の くさに ぶつかるまでの 時間を はかる（ジャンプしない）
  for (const fps of [30, 60, 120]) {
    const { p, logs } = await page(b, { fps });
    await p.bringToFront();
    await click(p, 'おでかけ');
    await sleep(300);
    await p.evaluate(() => [...document.querySelectorAll('.place')].find((e) => e.innerText.includes('はらっぱ')).click());
    await sleep(500);
    if (fps === 60) await p.screenshot({ path: 'shots/run-ready.png' });
    if (fps === 60) { const st = await p.$('.run-stage'); const bx = await st.boundingBox(); await p.mouse.click(bx.x + 50, bx.y + 50); await sleep(1700); await p.screenshot({ path: 'shots/run-mid.png' }); await p.close(); continue; }
    const stage = await p.$('.run-stage');
    const box = await stage.boundingBox();
    // スタート時に 1回 ジャンプする。着地後は ジャンプしない
    await p.mouse.click(box.x + 50, box.y + 50);
    const t0 = Date.now();
    while (!(await p.evaluate(() => !!document.querySelector('.run-cover.is-end')))) {
      await sleep(20);
      if (Date.now() - t0 > 15000) break;
    }
    const ms = Date.now() - t0;
    if (fps === 60) await p.screenshot({ path: 'shots/run-end.png' });
    console.log(`fps ${fps}: ぶつかるまで ${ms}ms`, 'errors:', logs.length ? logs : 0);
    await p.close();
  }

  // 4) はらっぱ：上手に とぶと コインが 入る（くさの 手前で ジャンプする 自動操作）
  {
    const { p, logs } = await page(b, {});
    const before = await p.evaluate(() => window.__mini.getState().coins);
    await click(p, 'おでかけ');
    await sleep(300);
    await p.evaluate(() => [...document.querySelectorAll('.place')].find((e) => e.innerText.includes('はらっぱ')).click());
    await sleep(400);
    const stage = await p.$('.run-stage');
    const box = await stage.boundingBox();
    await p.mouse.click(box.x + 50, box.y + 50);
    const t0 = Date.now();
    let score = '';
    // スコアが 9 に なったら わざと やめる（ぶつかる まで 待つ）
    while (Date.now() - t0 < 40000) {
      score = await p.evaluate(() => document.querySelector('.run-score')?.innerText.trim());
      if (await p.evaluate(() => !!document.querySelector('.run-cover.is-end'))) break;
      await p.mouse.click(box.x + 50, box.y + 50);
      await sleep(90);
    }
    const after = await p.evaluate(() => ({ coins: window.__mini.getState().coins, best: window.__mini.getState().playBest, outings: window.__mini.getState().outings.n }));
    console.log('連打で あそぶ: score', score, 'coins', before, '->', after.coins, 'best', after.best, 'outings', after.outings, 'errors:', logs.length ? logs : 0);
    await p.close();
  }
  await b.close();
})();
