// ぴよこが 歩きまわるか・なでたら 止まって ゆれるか を 数値で 確かめる
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(b, reduce) {
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
  const logs = [];
  p.on('pageerror', (e) => logs.push(e.message));
  await p.evaluateOnNewDocument(() => {
    if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); }
  });
  await p.goto('http://localhost:5181/');
  await sleep(600);
  await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => e.innerText.includes('はじめる'))?.click());
  return { p, logs };
}
const hatch = (p) =>
  p.evaluate(() => {
    const g = window.__mini;
    const s = g.getState();
    g.setState({ overlays: [], pet: { ...s.pet, hatchedAt: Date.now(), bornAt: Date.now(), name: 'ぴよすけ' } });
  });
// ぴよこの 中心の x（画面の 幅に 対する %）と 向き
const pos = (p) =>
  p.evaluate(() => {
    const el = document.querySelector('.pet');
    const area = el.parentElement.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(((r.left + r.width / 2 - area.left) / area.width) * 1000) / 10,
      left: !!document.querySelector('.pet-face.is-left'),
      walking: !!document.querySelector('.pet-img.is-walking'),
      swaying: !!document.querySelector('.pet-sway.is-swaying'),
    };
  });

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });

  // 1) たまごの あいだは 動かない
  {
    const { p } = await open(b);
    const xs = [];
    for (let i = 0; i < 6; i++) { xs.push((await pos(p)).x); await sleep(500); }
    console.log('たまご: x =', xs.join(','));
    await p.close();
  }

  // 2) かえったら 歩きまわる（12秒 見る）
  {
    const { p, logs } = await open(b);
    await hatch(p);
    const seen = [];
    for (let i = 0; i < 48; i++) { seen.push(await pos(p)); await sleep(250); }
    const xs = seen.map((s) => s.x);
    console.log('ひよこ: x の範囲', Math.min(...xs), '〜', Math.max(...xs), '/ 歩いていた割合', Math.round((seen.filter((s) => s.walking).length / seen.length) * 100) + '%', '/ 左向きに なった', seen.some((s) => s.left), '/ 右向き', seen.some((s) => !s.left));
    await p.screenshot({ path: 'shots/walk-1.png' });

    // 3) 歩いている 最中に なでる → 止まって ゆれる
    for (let i = 0; i < 40 && !(await pos(p)).walking; i++) await sleep(150);
    const before = await pos(p);
    const box = await (await p.$('.pet')).boundingBox();
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(120);
    const a = await pos(p);
    await sleep(800);
    const c = await pos(p);
    await p.screenshot({ path: 'shots/walk-2-pat.png' });
    console.log('なでた: 前', JSON.stringify(before), '直後', JSON.stringify(a), '0.8秒後', JSON.stringify(c));
    console.log('なでて 止まった:', Math.abs(c.x - a.x) < 1.5, '/ ゆれた:', a.swaying, '/ errors', logs.length);
    await p.close();
  }

  // 4) 動きを へらす 設定 では 歩かない
  {
    const { p } = await open(b, true);
    await hatch(p);
    await sleep(500);
    const xs = [];
    for (let i = 0; i < 10; i++) { xs.push((await pos(p)).x); await sleep(400); }
    console.log('動きを へらす: x =', [...new Set(xs)].join(','));
    await p.close();
  }
  await b.close();
})();
