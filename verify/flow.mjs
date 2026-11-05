// 実画面の 通し。音は 出さない。node verify/flow.mjs <出力フォルダ>
import { createRequire } from "module";
import { spawn } from "node:child_process";
import { MUTE_LAUNCH, muteContext } from "/Users/tomoki/.claude/skills/bakage/templates/mute.mjs";
const { chromium, webkit } = createRequire("/Users/tomoki/tools/pw/")("playwright");
const OUT = process.argv[2]; const PORT = 5197;
const srv = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
await new Promise((r) => setTimeout(r, 1800));
let ok = 0, ng = 0; const chk = (n, c) => { c ? ok++ : (ng++, console.log("NG", n)); };
async function run(type, name, vp) {
  const b = await type.launch(type === chromium ? MUTE_LAUNCH : {});
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, locale: "ja-JP", hasTouch: true, colorScheme: "light", reducedMotion: "no-preference" });
  await muteContext(ctx); const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/mediapipe|camera/i.test(m.text())) errs.push(m.text()); });
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  const click = (t) => p.getByRole("button", { name: t }).first().evaluate((e) => e.click());
  const shot = async (n) => { await p.waitForTimeout(450); if (name === "c390") await p.screenshot({ path: `${OUT}/${n}.png` }); };
  const fits = async (n) => { const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: innerWidth, sh: document.documentElement.scrollHeight, ch: innerHeight, over: [...document.querySelectorAll(".card")].filter((e) => { const b = e.getBoundingClientRect(); return b.top < -1 || b.bottom > innerHeight + 1; }).length })); chk(`${name} ${n} はみ出し ${JSON.stringify(r)}`, r.sw <= r.cw && r.sh <= r.ch + 1 && r.over === 0); };
  const menu = async (t) => { await p.getByRole("button", { name: "メニュー" }).evaluate((e) => e.click()); await p.waitForTimeout(150); await click(t); await p.waitForTimeout(350); };
  await shot("01_help"); await fits("help");
  await click("はじめる"); await p.waitForTimeout(11000);
  await click("やったね"); await p.waitForTimeout(250);
  await p.getByPlaceholder("ぴよこ").fill("もも"); await shot("02_name"); await click("これにする"); await p.waitForTimeout(250);
  chk(`${name} 歩数の案内`, await p.getByText("あるくと ごはん代が とどく").count()); await shot("03_ask"); await fits("ask"); await click("歩数を つかう"); await p.waitForTimeout(450);
  chk(`${name} 最初は ごはん代 あと5回`, await p.getByText("あと 5かい").count()); await shot("04_home"); await fits("home");
  await menu("試作: 5かい うごいた");
  chk(`${name} 5回で その場で ごはんを 聞く`, await p.getByText("おにぎりが 買えるよ").count()); await shot("05_offer"); await fits("offer");
  await click("あげる"); await p.waitForTimeout(350);
  chk(`${name} たべる ところが 見える`, await p.locator(".eat-food").count()); await shot("05b_eating");
  const coins = await p.locator(".coin-pill").first().innerText(); chk(`${name} 5回でおにぎり1個買える coins=${coins}`, /\b0\b/.test(coins));
  await p.waitForTimeout(1200); chk(`${name} たべ終わると 消える`, (await p.locator(".eat-food").count()) === 0);
  await menu("試作: 6000ほ あるいた"); await click("うけとる"); await p.waitForTimeout(200);
  chk(`${name} 満腹の時は ごはんを 聞かない`, (await p.getByText("おにぎりが 買えるよ").count()) === 0);
  await menu("試作: 1にち すすめる");
  await menu("試作: 6000ほ あるいた");
  chk(`${name} 歩数が届く`, await p.getByText("6,000ほ ぶん").count()); await shot("06_delivery"); await fits("delivery"); await click("うけとる"); await p.waitForTimeout(250);
  chk(`${name} 歩数でも ごはんを 聞く`, await p.getByText("おにぎりが 買えるよ").count()); await click("あとで"); await p.waitForTimeout(200);
  chk(`${name} あとでで 消える`, (await p.getByText("おにぎりが 買えるよ").count()) === 0);
  await menu("試作: 1にち すすめる"); await p.waitForTimeout(400);
  chk(`${name} きのうの 歩数を 覚えている`, await p.getByText("きのう 6,000ほも あるいたね").count()); await shot("06b_memory");
  for (let i = 0; i < 2; i++) await menu("試作: 1にち すすめる");
  chk(`${name} 3日放置でも 消えない`, (await p.getByText("いえで しちゃった").count()) === 0); await shot("07_after3days"); await fits("waiting");
  for (let i = 0; i < 3; i++) await menu("試作: 1にち すすめる");
  chk(`${name} 6日放置で おでかけ`, await p.getByText("おでかけ中").count()); await shot("08_away"); await fits("away");
  await menu("試作: 5かい うごいた");
  chk(`${name} 迎えに行くと 帰る`, await p.getByText("かえってきた").count()); await shot("09_back"); await click("おかえり"); await p.waitForTimeout(250);
  for (let i = 0; i < 19 && !(await p.getByText("この先も そだてる").count()); i++) { await menu("試作: 5かい うごいた"); for (const t of ["やったね", "あとで"]) if (await p.getByRole("button", { name: t }).count()) await click(t); await p.waitForTimeout(100); }
  chk(`${name} 100回で 課金の入り口`, await p.getByText("この先も そだてる").count()); await shot("10_paywall"); await fits("paywall");
  await click("いまは いい"); await p.waitForTimeout(250);
  chk(`${name} 断っても 消えない`, await p.locator(".pet").count()); chk(`${name} つづきの入口が残る`, await p.getByRole("button", { name: "つづきを そだてる" }).count()); await shot("11_declined");
  await click("つづきを そだてる"); await p.waitForTimeout(250); await p.getByRole("button", { name: /で つづきを みる/ }).evaluate((e) => e.click()); await p.waitForTimeout(450);
  chk(`${name} 買うと しょうがくせい`, await p.getByText("しょうがくせいに なった").count()); await shot("12_grew");
  // おとなは 自分で 送りだす。時間では いなくならない
  if (name === "c390") {
    await p.evaluate(() => 0);
    for (let i = 0; i < 60 && !(await p.getByText("おとなに なった").count()); i++) { await menu("試作: 5かい うごいた"); for (const t of ["やったね", "あとで", "はじめる"]) if (await p.getByRole("button", { name: t }).count()) await click(t); await p.waitForTimeout(60); }
    chk(`${name} おとなに なる`, await p.getByText("おとなに なった").count());
    for (let i = 0; i < 10; i++) await menu("試作: 1にち すすめる");
    chk(`${name} 10日たっても ひとりだち しない`, (await p.getByText("ひとりだち しました").count()) === 0);
    chk(`${name} おでかけ中は 送りだせない`, await (async () => { await p.getByRole("button", { name: "メニュー" }).evaluate((e) => e.click()); await p.waitForTimeout(150); const n = await p.getByRole("button", { name: "ひとりだち させる" }).count(); await p.getByRole("button", { name: "とじる" }).first().evaluate((e) => e.click()); await p.waitForTimeout(150); return n === 0; })());
    await menu("試作: 5かい うごいた"); await click("おかえり"); await p.waitForTimeout(200); if (await p.getByRole("button", { name: "あとで" }).count()) await click("あとで");
    await menu("ひとりだち させる"); await shot("13_leave"); await click("おくりだす"); await p.waitForTimeout(350);
    chk(`${name} 自分で 送りだせる`, await p.getByText("ひとりだち しました").count()); await shot("14_left");
  }
  chk(`${name} 無音`, await p.evaluate(() => (window.__muteOk ? window.__muteOk() : true)));
  chk(`${name} エラー0 ${JSON.stringify(errs)}`, errs.length === 0);
  await b.close();
}
try {
  await run(chromium, "c390", { width: 390, height: 844 });
  await run(chromium, "c360", { width: 360, height: 640 });
  await run(chromium, "c430", { width: 430, height: 932 });
  await run(webkit, "w390", { width: 390, height: 844 });
} catch (e) { ng++; console.log("例外", e.message.slice(0, 400)); }
process.kill(-srv.pid); console.log(`flow: ${ok} ok, ${ng} NG`); process.exit(ng ? 1 : 0);
