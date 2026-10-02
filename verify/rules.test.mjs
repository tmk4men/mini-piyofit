// node verify/rules.test.mjs  （先に esbuild で rules.ts を verify/rules.mjs に書き出す）
import * as R from "./rules.mjs";
import * as E from "./economy.mjs";

let fail = 0;
const t = async (name, fn) => {
  try {
    await fn();
    console.log("ok  ", name);
  } catch (e) {
    fail++;
    console.log("FAIL", name, "\n     ", e.message);
  }
};
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: ${a} !== ${b}`); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) throw new Error(`${m}: ${a} vs ${b}`); };
const H = R.HOUR;
const T0 = 1_800_000_000_000;

// かえった ばかりの 子（T0 に かえった）
const hatched = () => ({ ...R.newPet(1, T0), hatchedAt: T0 });

await t("たまごの あいだ（10秒まで）は 何も減らない", () => {
  const r = R.tick(R.newPet(1, T0), T0 + 9_000);
  eq(r.ending, null, "ending");
  eq(r.pet.hunger, 80, "hunger");
  eq(r.pet.poops, 0, "poops");
});

await t("たまごは むかえて 10秒で かえり、誕生日が かえった時刻になる", () => {
  const egg = R.newPet(1, T0);
  const r1 = R.tick(egg, T0 + 9_900);
  eq(r1.hatched, false, "9.9秒");
  eq(R.stageOf(r1.pet).id, "egg", "まだ たまご");
  const r2 = R.tick(r1.pet, T0 + 10_000);
  eq(r2.hatched, true, "10秒");
  eq(R.stageOf(r2.pet).id, "hiyoko", "ひよこ");
  eq(r2.pet.bornAt, T0 + 10_000, "bornAt");
});

await t("ひさしぶりに ひらいても かえった あとの 時間だけ へる", () => {
  const r = R.tick(R.newPet(1, T0), T0 + 10_000 + 8 * H);
  eq(r.hatched, true, "hatched");
  near(r.pet.hunger, 80 - 50, 0.01, "8時間ぶん");
});

await t("たまごの あいだの うんどうでは かえらない（時間で かえる）", () => {
  const r = R.addReps(R.newPet(1, T0), 30, T0);
  eq(r.grew, null, "grew");
  eq(R.stageOf(r.pet).id, "egg", "egg");
});

await t("おなかは 16時間で 100減る（8時間で 半分）", () => {
  const p = { ...hatched(), hunger: 100, mood: 100 };
  const r = R.tick(p, T0 + 8 * H);
  near(r.pet.hunger, 50, 0.01, "hunger");
});

await t("うんちは 4時間ごと、最大3個", () => {
  const p = { ...hatched(), hunger: 100, mood: 100 };
  eq(R.tick(p, T0 + 3.9 * H).pet.poops, 0, "3.9h");
  eq(R.tick(p, T0 + 4 * H).pet.poops, 1, "4h");
  eq(R.tick(p, T0 + 8 * H).pet.poops, 2, "8h");
  // 13時間で 3個。16時間目以降も 3個のまま
  const late = R.tick({ ...p, hunger: 100, mood: 100 }, T0 + 20 * H);
  eq(late.pet.poops, 3, "20h");
});

await t("うんちがあると きげんが 速く減る", () => {
  const base = { ...hatched(), hunger: 100, mood: 100 };
  const clean = R.tick(base, T0 + 2 * H).pet.mood;
  const dirty = R.tick({ ...base, poops: 2 }, T0 + 2 * H).pet.mood;
  if (!(dirty < clean)) throw new Error(`dirty ${dirty} clean ${clean}`);
  near(100 - dirty, (100 - clean) * 2, 0.01, "2個で2倍");
});

// しっかり せわ = おなかを いっぱいまで、そうじ、なでて きげんを いっぱいまで
const care = (p) => {
  for (let k = 0; k < 10; k++) { const r = R.feed(p); if (!r.ok) break; p = r.pet; }
  p = R.clean(p);
  for (let k = 0; k < 30; k++) p = R.pat(p);
  return p;
};

await t("おなかが 0 に なった しゅんかんに いえで（待ち時間なし）", () => {
  // おなか 30 は 4.8時間で 0（1時間に 6.25 へる）
  const p = { ...hatched(), hunger: 30, mood: 100 };
  eq(R.tick(p, T0 + 4.7 * H).ending, null, "4.7h");
  eq(R.tick(p, T0 + 4.9 * H).ending, "runaway", "4.9h");
});

await t("きげんが 0 でも すぐ いえで", () => {
  const p = { ...hatched(), hunger: 100, mood: 5 };
  eq(R.tick(p, T0 + 1.3 * H).ending, "runaway", "1.3h");
});

await t("満タンから 完全放置は 10〜16時間で いえで（うんちで きげんが 先に つきる）", () => {
  const p = { ...hatched(), hunger: 100, mood: 100 };
  eq(R.tick(p, T0 + 9 * H).ending, null, "9h");
  eq(R.tick(p, T0 + 16 * H).ending, "runaway", "16h");
});

await t("12時間ごとに しっかり せわすれば 7日間 いえでしない", () => {
  let p = care({ ...hatched() });
  for (let i = 1; i <= 14; i++) {
    const r = R.tick(p, T0 + i * 12 * H);
    eq(r.ending, null, `${i * 12}h`);
    p = care(r.pet);
  }
});

await t("1日1回の せわでは もたない（16時間で おなかが つきる）", () => {
  const p = care({ ...hatched() });
  eq(R.tick(p, T0 + 24 * H).ending, "runaway", "24h");
});

await t("うんどうでは おなかが 0 に ならない（うんどうで いえで させない）", () => {
  const p = { ...hatched(), hunger: 3, mood: 50 };
  const r = R.addReps(p, 50, T0);
  eq(r.pet.hunger, 1, "hunger");
  eq(R.tick(r.pet, T0 + 60_000).ending, null, "直後");
});

await t("おなか いっぱい（90以上）は たべない", () => {
  const p = { ...hatched(), hunger: 90 };
  eq(R.feed(p).ok, false, "ok");
  eq(R.feed({ ...p, hunger: 89 }).ok, true, "89");
  eq(R.feed({ ...p, hunger: 89 }).pet.hunger, 100, "上限100");
});

await t("400回で おとな、72時間後に ひとりだち", () => {
  let p = hatched();
  const r = R.addReps(p, 400, T0 + H);
  eq(r.grew?.id, "adult", "grew");
  p = { ...r.pet, hunger: 100, mood: 100 };
  eq(p.adultAt, T0 + H, "adultAt");
  // 3日間 せわを つづける（12時間ごと）
  let cur = p;
  for (let h = 12; h < 72; h += 12) {
    const x = R.tick(cur, T0 + H + h * H);
    eq(x.ending, null, `${h}h`);
    cur = R.clean({ ...x.pet, hunger: 100, mood: 100 });
  }
  eq(R.tick(cur, T0 + H + 72 * H).ending, "leave", "72h");
});

await t("段階は 1回ずつ 正しい順に上がる", () => {
  let p = hatched();
  const seen = [];
  for (let i = 0; i < 400; i++) {
    const r = R.addReps(p, 1, T0);
    p = r.pet;
    if (r.grew) seen.push(r.grew.id);
  }
  eq(seen.join(","), "kinder,elementary,junior,high,adult", "order");
});

await t("一度に 大量の回数で 段階を飛ばしても 最後の段階を返す", () => {
  const r = R.addReps(hatched(), 150, T0);
  eq(r.grew?.id, "elementary", "grew");
});

await t("ハートは 0〜4（0 のときだけ 0個）", () => {
  eq(R.hearts(0), 0, "0");
  eq(R.hearts(0.1), 1, "0.1");
  eq(R.hearts(25), 1, "25");
  eq(R.hearts(25.1), 2, "25.1");
  eq(R.hearts(100), 4, "100");
  eq(R.hearts(150), 4, "150");
});

await t("時間が 巻き戻っても 壊れない", () => {
  const p = hatched();
  const r = R.tick(p, T0 - 5 * H);
  eq(r.pet, p, "same");
});

await t("30日 放置しても 1秒以内に 計算が終わる", () => {
  const s = performance.now();
  R.tick({ ...hatched(), hunger: 100, mood: 100, zeroSince: null }, T0 + 30 * 24 * H);
  const ms = performance.now() - s;
  if (ms > 1000) throw new Error(ms + "ms");
});

await t("そうじの直後は 4時間 うんちが出ない", () => {
  let p = { ...hatched(), hunger: 100, mood: 100 };
  p = R.tick(p, T0 + 7.9 * H).pet;
  eq(p.poops, 1, "7.9h");
  p = R.clean(p);
  eq(R.tick(p, T0 + 8.5 * H).pet.poops, 0, "そうじ後0.6h");
  eq(R.tick(p, T0 + 11.9 * H).pet.poops, 1, "そうじ後4h");
});

await t("ごはん: おなかも きげんも いっぱいなら たべない。片方 あいてれば たべる", () => {
  const [onigiri, bento, cake] = E.FOODS;
  const full = { ...hatched(), hunger: 95, mood: 95 };
  eq(E.canEat(full, onigiri), false, "onigiri full");
  eq(E.canEat(full, cake), false, "cake full");
  eq(E.canEat({ ...full, mood: 50 }, cake), true, "cake mood空き");
  eq(E.canEat({ ...full, mood: 50 }, onigiri), false, "onigiri おなかいっぱい");
  eq(E.eat({ ...full, hunger: 80 }, bento).hunger, 100, "上限100");
});

await t("ごはんで 0 から戻すと いえでの カウントが 消える（コイン版）", () => {
  const p = { ...hatched(), hunger: 0, mood: 50, zeroSince: T0 };
  eq(E.eat(p, E.FOODS[0]).zeroSince, null, "zeroSince");
});

await t("1日の うんどう 15回分の コインで おなかを 保てる", () => {
  // おなかは 1日 150 へる。おにぎり 5こ = 150コイン = 15回
  eq(Math.ceil(150 / E.FOODS[0].hunger) * E.FOODS[0].price / E.REP_COINS, 15, "15回");
});

await t("おでかけ: たまごは どこにも いけない。であいは おとなだけ", () => {
  const egg = R.newPet(1, T0);
  for (const pl of E.PLACES) eq(E.placeOpen(egg, pl), false, pl.id);
  const kid = hatched();
  eq(E.placeOpen(kid, E.PLACES.find((x) => x.id === "date")), false, "date kid");
  eq(E.placeOpen(kid, E.PLACES.find((x) => x.id === "grandpa")), true, "grandpa kid");
  const adult = R.addReps(kid, 400, T0).pet;
  eq(E.placeOpen(adult, E.PLACES.find((x) => x.id === "date")), true, "date adult");
});

await t("であいに 3回 いくと なかよし 3（それ以上は ふえない）", () => {
  const date = E.PLACES.find((x) => x.id === "date");
  let p = R.addReps(hatched(), 400, T0).pet;
  p = E.goOut(p, date, 0.1).pet;
  const name = p.partner.name;
  p = E.goOut(p, date, 0.9).pet;
  p = E.goOut(p, date, 0.5).pet;
  p = E.goOut(p, date, 0.5).pet;
  eq(p.partner.bond, E.BOND_TO_PROPOSE, "bond");
  eq(p.partner.name, name, "相手は かわらない");
});

await t("はらっぱは むりょうで、たまご いがい なら いける", () => {
  const field = E.PLACES.find((x) => x.id === "field");
  eq(field.price, 0, "price");
  eq(E.placeOpen(R.newPet(1, T0), field), false, "egg");
  eq(E.placeOpen(hatched(), field), true, "hiyoko");
  eq(E.PLAY_MAX_COINS % E.PLAY_COIN_PER_OBSTACLE, 0, "上限は 3の倍数");
});

console.log(fail ? `\n${fail} 件 失敗` : "\nぜんぶ OK");
process.exit(fail ? 1 : 0);
