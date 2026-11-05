// 画面を ひらいた時に 歩数を 受け取り、とじる時に 通知と ウィジェットを 更新する
import { useGame, dayKey } from "../game/store";
import { HOUR, HUNGER_EMPTY_H, isEgg, stageOf } from "../game/rules";
import { dailySteps, isEntitled, isNative, pushWidget, requestNotify, scheduleHungry } from "./bridge";

/** おなかが この値まで 減ったら 知らせる */
const HUNGRY_AT = 25;

/** 通知は 朝8時〜夜9時に 出す */
export function clampToDaytime(at: number): number {
  const d = new Date(at);
  const h = d.getHours();
  if (h >= 8 && h < 21) return at;
  if (h >= 21) d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}

export function hungryAt(hunger: number, now: number): number {
  const hours = Math.max(0, hunger - HUNGRY_AT) / (100 / HUNGER_EMPTY_H);
  return clampToDaytime(now + Math.max(hours, 1) * HOUR);
}

export async function onOpen(): Promise<void> {
  const g = useGame.getState;
  // きのうの 歩数を 受け取ってから 覚えていることを 言う
  if (!isNative()) {
    g().openDay();
    return;
  }
  if (!g().unlocked && (await isEntitled())) g().unlock();
  const from = g().stepsFrom;
  if (from) {
    const days = await dailySteps(from);
    if (days.length) g().receiveSteps(days);
  }
  g().openDay();
}

export async function onLeave(): Promise<void> {
  if (!isNative()) return;
  const { pet, firstMeal } = useGame.getState();
  if (isEgg(pet)) return;
  const name = pet.name || "ぴよこ";
  await pushWidget({ name, image: stageOf(pet).img, hunger: pet.hunger, mood: pet.mood, away: !!pet.away, at: Date.now() });
  if (firstMeal && !pet.away) await scheduleHungry(hungryAt(pet.hunger, Date.now()), name);
}

/** はじめて ごはんを あげた あとに 一度だけ 聞く */
let asked = false;
export function askNotifyAfterMeal(): void {
  if (asked || !isNative()) return;
  asked = true;
  void requestNotify();
}

export { dayKey };
