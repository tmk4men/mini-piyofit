const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const p = await b.newPage();
  const logs = [];
  p.on('pageerror', e => logs.push(e.message));
  // コインなし版(v1)の保存データを アプリより先に置く
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    const now = Date.now();
    localStorage.setItem('mini-piyofit-v1', JSON.stringify({ version: 1, state: {
      pet: { gen: 2, name: 'むかし', bornAt: now, reps: 120, hunger: 50, mood: 50, poops: 1, poopClock: 0, zeroSince: null, adultAt: null, lastTick: now },
      album: [{ gen: 1, name: 'いちばん', reps: 400, days: 5, ending: 'leave', endedAt: now }],
      today: { day: 'x', reps: 0 }, seenHelp: true } }));
  });
  await p.goto('http://localhost:5181/'); await new Promise(r => setTimeout(r, 1500));
  console.log(JSON.stringify(await p.evaluate(() => { const s = window.__mini.getState(); return { name: s.pet.name, reps: s.pet.reps, coins: s.coins, owned: s.owned, wearing: s.wearing, outings: s.outings.n, album: s.album.length }; })));
  console.log('errors', logs.length ? logs : 'none');
  await b.close();
})();
