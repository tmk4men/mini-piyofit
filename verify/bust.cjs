// キャッシュバスターの 確認：開く → (外で ビルドしなおす) → 開きなおす で SW の 保存名が かわり 古いのが 消えるか
// node bust.cjs first  … 1回目を ひらいて 状態を ファイルに のこす
// node bust.cjs second … 2回目
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL0 = process.env.URL || 'http://localhost:5190/mini-piyofit/';
const PROFILE = __dirname + '/.bust-profile';

(async () => {
  const phase = process.argv[2];
  if (phase === 'first') fs.rmSync(PROFILE, { recursive: true, force: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', userDataDir: PROFILE });
  const p = await b.newPage();
  await p.goto(URL0, { waitUntil: 'networkidle2' });
  await sleep(1500);
  // SW が うごきだしてから もういちど 読みこむ（2回目の 表示を SW 経由に する）
  await p.reload({ waitUntil: 'networkidle2' });
  await sleep(1500);
  const info = await p.evaluate(async () => ({
    caches: await caches.keys(),
    sw: (await navigator.serviceWorker.getRegistration())?.active?.scriptURL,
    imgs: [...new Set([...document.querySelectorAll('img')].map((i) => i.getAttribute('src')))].slice(0, 3),
  }));
  console.log(phase, JSON.stringify(info, null, 1));
  await b.close();
})();
