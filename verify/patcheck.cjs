// 公開URLで なでたときの 反応（ゆれ・ハート）を WebKit で 確かめる。RM=1 で 動きを へらす 設定
const { webkit } = require('playwright-core');
const path = require('path');
const TARGET = process.env.URL || 'https://tmk4men.github.io/mini-piyofit/';
(async () => {
  const b = await webkit.launch({ executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const logs = [];
  p.on('pageerror', (e) => logs.push(e.message));
  await p.goto(TARGET + '?t=' + Date.now());
  await p.waitForTimeout(2000);
  await p.getByText('はじめる').click();
  await p.waitForTimeout(11500);
  await p.getByText('やったね').click();
  await p.locator('.name-input').fill('ぴよすけ');
  await p.getByText('これにする').click();
  await p.waitForTimeout(800);
  await p.locator('.pet').tap();
  await p.waitForTimeout(250);
  const r = await p.evaluate(() => {
    const sway = document.querySelector('.pet-sway');
    const f = document.querySelector('.floater');
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      swayClass: sway?.className,
      swayAnim: cs(sway)?.animationName + ' ' + cs(sway)?.animationDuration,
      swayRotate: cs(sway)?.rotate,
      floaters: document.querySelectorAll('.floater').length,
      floaterOpacity: cs(f)?.opacity,
      floaterAnim: cs(f)?.animationName + ' ' + cs(f)?.animationDuration,
      bubble: document.querySelector('.bubble')?.innerText,
    };
  });
  await p.screenshot({ path: `shots/patcheck${process.env.RM ? '-rm' : ''}.png` });
  console.log(process.env.RM ? '動きを減らす' : '通常', JSON.stringify(r), 'errors', logs.length);
  await b.close();
})();
