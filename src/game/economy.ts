// コイン・おみせ・おでかけ・けっこん の数字と純関数

import { stageOf, type Pet } from "./rules";

/** うんどう 1回で もらえる コイン */
export const REP_COINS = 10;
/** はじめて あそぶ ときの コイン */
export const START_COINS = 200;
/** けっこんの おいわい */
export const WEDDING_GIFT = 300;
/** おでかけは 1日 この回数まで */
export const OUTINGS_PER_DAY = 3;
/** しょうがいぶつ きょうそう：1こ こえるごとの コインと、1かいの 上限 */
export const PLAY_COIN_PER_OBSTACLE = 3;
export const PLAY_MAX_COINS = 90;
/** けっこん できる なかよし */
export const BOND_TO_PROPOSE = 3;

export interface Food {
  id: string;
  name: string;
  price: number;
  hunger: number;
  mood: number;
}

export const FOODS: Food[] = [
  { id: "onigiri", name: "おにぎり", price: 30, hunger: 30, mood: 0 },
  { id: "bento", name: "おべんとう", price: 70, hunger: 60, mood: 10 },
  { id: "cake", name: "ケーキ", price: 60, hunger: 10, mood: 30 },
];

export type OutfitId = "ribbon" | "cap" | "scarf";

export interface Outfit {
  id: OutfitId;
  name: string;
  price: number;
}

export const OUTFITS: Outfit[] = [
  { id: "ribbon", name: "リボン", price: 300 },
  { id: "cap", name: "キャップ", price: 400 },
  { id: "scarf", name: "マフラー", price: 500 },
];

/** 着せたときの 位置（ぴよこ画像の 幅に対する 割合） */
export const OUTFIT_FIT: Record<OutfitId, { width: number; top: number }> = {
  ribbon: { width: 0.3, top: 0.06 },
  cap: { width: 0.44, top: -0.02 },
  scarf: { width: 0.56, top: 0.5 },
};

/** 段階ごとに 首の 高さが ちがうので マフラーだけ ずらす */
const SCARF_TOP: Partial<Record<string, number>> = { junior: 0.46, high: 0.4, adult: 0.39 };

export function outfitFit(id: OutfitId, stageId: string): { width: number; top: number } {
  const base = OUTFIT_FIT[id];
  if (id === "scarf" && SCARF_TOP[stageId] != null) return { ...base, top: SCARF_TOP[stageId]! };
  return base;
}

/** おなかが いっぱいで、きげんも いっぱいなら たべない */
export function canEat(pet: Pet, f: Food): boolean {
  const hungerHelps = f.hunger > 0 && pet.hunger < 90;
  const moodHelps = f.mood > 0 && pet.mood < 90;
  return hungerHelps || moodHelps;
}

export function eat(pet: Pet, f: Food): Pet {
  const hunger = Math.min(100, pet.hunger + f.hunger);
  const mood = Math.min(100, pet.mood + f.mood);
  return { ...pet, hunger, mood, zeroSince: hunger > 0 && mood > 0 ? null : pet.zeroSince };
}

export type PlaceId = "grandpa" | "dagashi" | "field" | "date";

export interface Place {
  id: PlaceId;
  name: string;
  note: string;
  price: number;
  bg: string;
  host: string | null;
}

export const PLACES: Place[] = [
  { id: "grandpa", name: "おじいちゃんの いえ", note: "のんびり おはなし。きげんが ふえる", price: 0, bg: "/grandpa_house.webp", host: "/grandpa.webp" },
  { id: "dagashi", name: "だがしや", note: "おかしを かって たべる", price: 20, bg: "/dagashi_shop.webp", host: "/dagashi_oba.webp" },
  { id: "field", name: "はらっぱ", note: "しょうがいぶつ きょうそう。こえた ぶん コイン", price: 0, bg: "/play-bg.webp", host: null },
  { id: "date", name: "であいの おうち", note: "すてきな あいてに あいに いく", price: 0, bg: "/partner_house.webp", host: "/piyo_partner.webp" },
];

export const PARTNER_NAMES = ["ぴよみ", "ひなこ", "ことり", "もも", "ぽぽ", "すず"];

export function placeOpen(pet: Pet, p: Place): boolean {
  const st = stageOf(pet).id;
  if (st === "egg") return false;
  if (p.id === "date") return st === "adult";
  return true;
}

/** おなかも きげんも 0 でなくなったら いえでの カウントを とめる */
const settle = (before: Pet, next: Pet): Pet => ({
  ...next,
  zeroSince: next.hunger > 0 && next.mood > 0 ? null : before.zeroSince,
});

export interface OutingResult {
  pet: Pet;
  coins: number;
  lines: string[];
}

/** おでかけ 1回ぶん。rand は 0〜1 */
export function goOut(pet: Pet, p: Place, rand: number): OutingResult {
  switch (p.id) {
    case "grandpa": {
      const coins = rand < 0.3 ? 30 : 0;
      return {
        pet: settle(pet, { ...pet, mood: Math.min(100, pet.mood + 25) }),
        coins,
        lines: coins ? ["「よう きたな。これ おこづかいじゃ」", "きげん +25 / コイン +30"] : ["「よう きたな。ゆっくり していき」", "きげん +25"],
      };
    }
    case "dagashi": {
      const next = { ...pet, hunger: Math.min(100, pet.hunger + 15), mood: Math.min(100, pet.mood + 20) };
      return {
        pet: settle(pet, next),
        coins: 0,
        lines: ["「まいど。あんた また ふとったんじゃないの」", `おなか +15 / きげん +20 / コイン -${p.price}`],
      };
    }
    case "field":
      // ゲームの 結果は あそんだ あとで finishPlay が わたす
      return { pet, coins: 0, lines: [] };
    case "date": {
      const name = pet.partner?.name ?? PARTNER_NAMES[Math.floor(rand * PARTNER_NAMES.length)];
      const bond = Math.min(BOND_TO_PROPOSE, (pet.partner?.bond ?? 0) + 1);
      return {
        pet: settle(pet, { ...pet, partner: { name, bond }, mood: Math.min(100, pet.mood + 10) }),
        coins: 0,
        lines: [
          bond === 1 ? `${name}と であった！` : `${name}と なかよく すごした`,
          bond >= BOND_TO_PROPOSE ? "いまなら プロポーズ できそう" : `なかよし ${bond} / ${BOND_TO_PROPOSE}`,
        ],
      };
    }
  }
}
