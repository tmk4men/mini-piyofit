// ひらいた瞬間、この子は もう 何かを している。あなたが いない間も 暮らしている感じを 出す
import { stageOf, type Pet } from "./rules";

export type SceneId = "nap" | "window" | "box" | "chair" | "toilet" | "squat" | "poop";

export interface Scene {
  id: SceneId;
  /** 吹き出し。8〜12字 */
  line: string;
  /** なでて 気づいた ときの ひとこと */
  woke: string;
  /** 部屋の どこに いるか（%） */
  x: number;
  /** そばに ある物 */
  prop?: { img: string; x: number };
}

export const SCENES: Record<SceneId, Scene> = {
  nap: { id: "nap", line: "…すぅ…すぅ", woke: "…はっ。おかえり", x: 50 },
  window: { id: "window", line: "そと みてた", woke: "あ、おかえり！", x: 50 },
  box: { id: "box", line: "はこ みつけた！", woke: "はいってみたかった", x: 56, prop: { img: "cardboard.webp", x: 34 } },
  chair: { id: "chair", line: "すわれない…", woke: "おしりが とどかない", x: 40, prop: { img: "furniture_chair.webp", x: 66 } },
  toilet: { id: "toilet", line: "れんしゅう ちゅう", woke: "み、みないで", x: 38, prop: { img: "furniture_toilet.webp", x: 68 } },
  squat: { id: "squat", line: "スクワットの まね", woke: "みてた？ できてた？", x: 50 },
  poop: { id: "poop", line: "これ だれの？", woke: "ぼくじゃないよ", x: 62 },
};

/** 寝顔の 絵は ちいさい頃の ものしかない */
const canNap = (pet: Pet) => ["hiyoko", "kinder"].includes(stageOf(pet).id);

/** rand は 0〜1。同じ場面を 続けない。egg・おでかけ中・待っている時は 何もしない */
export function pickScene(pet: Pet, hour: number, last: SceneId | null, rand: number): SceneId | null {
  if (pet.hatchedAt == null || pet.away || pet.hunger <= 0 || pet.mood <= 0) return null;
  if ((hour >= 23 || hour < 6) && canNap(pet) && last !== "nap") return "nap";
  if (pet.poops > 0 && last !== "poop") return "poop";
  const pool: SceneId[] = ["window", "box", "chair", "toilet", "squat", "squat"];
  if (canNap(pet)) pool.push("nap");
  const choices = pool.filter((s) => s !== last);
  return choices[Math.min(choices.length - 1, Math.floor(rand * choices.length))];
}
