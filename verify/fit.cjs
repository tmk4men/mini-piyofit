const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const p = await b.newPage();
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await p.goto('http://localhost:5181/');
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload(); await new Promise(r => setTimeout(r, 1200));
  await p.evaluate(() => { const g = window.__mini; g.setState({ seenHelp: true, overlays: [], coins: 5000, owned: ['ribbon','cap','scarf'] }); });
  await p.reload(); await new Promise(r => setTimeout(r, 1200));
  const reps = [10, 40, 100, 180, 280, 400];
  let i = 0;
  for (const o of ['ribbon', 'cap', 'scarf']) for (const r of reps) {
    await p.evaluate((o, r) => { const g = window.__mini; const s = g.getState(); g.setState({ wearing: o, overlays: [], pet: { ...s.pet, reps: r, name: 'x', hunger: 100, mood: 100 } }); }, o, r);
    await new Promise(r => setTimeout(r, 250));
    const el = await p.$('.pet');
    await el.screenshot({ path: `shots/fit-${o}-${r}.png` });
  }
  await b.close();
})();
