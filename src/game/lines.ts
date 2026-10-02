import { stageOf, type Pet } from "./rules";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** いまの状態で ぴよこが いうこと。いちばん困っていることを優先する */
export function idleLine(pet: Pet): string {
  const stage = stageOf(pet);
  if (stage.id === "egg") return "…コツコツ。もうすぐ うまれそう";
  if (pet.hunger < 10) return "おなか ぺこぺこ… このままだと いえで しちゃう";
  if (pet.mood < 10) return "もう しらない。いえで しちゃうよ";
  if (pet.hunger < 25) return "おなか すいた…ごはん ほしい";
  if (pet.poops >= 2) return "うんち いっぱい。くさいよ〜";
  if (pet.mood < 25) return "つまんない。いっしょに うんどうしよ";
  if (pet.poops === 1) return "あ、うんち でちゃった";
  if (stage.id === "adult") {
    if (pet.partner && pet.partner.bond >= 3) return `${pet.partner.name}に プロポーズ したいな`;
    if (pet.partner) return `${pet.partner.name}に また あいたいな`;
    return pick(["であいの おうちに いってみたい", "スーツ にあう？", "そろそろ ひとりだち かな"]);
  }
  return pick([
    "きょうも いっしょに うごこ！",
    "ぴよ〜",
    "なでて なでて",
    "スクワット みせて！",
    "おおきく なりたいな",
    `${stage.label}に なったよ`,
  ]);
}

export const FEED_LINES = ["もぐもぐ…おいしい！", "ごちそうさま！", "おなか ぽかぽか"];
export const FULL_LINES = ["もう はいらないよ〜", "おなか いっぱい！"];
export const PAT_LINES = ["えへへ", "ぴよぴよ", "もっと なでて", "くすぐったい"];
export const CLEAN_LINES = ["すっきり！", "ぴかぴか！ ありがと"];
export const NO_POOP_LINES = ["きれいだよ？"];
export const REP_LINES = ["いいね！", "その ちょうし！", "かっこいい！", "ぴよっ！", "まだまだ！"];

export { pick };
