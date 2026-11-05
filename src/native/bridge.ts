// iPhone の 機能（歩数・買い切り・ウィジェット・通知）への 入り口。
// ブラウザでは 何もしない（試作の 確認用に 買い切りだけ 成功あつかい）。
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface StepDay {
  day: string;
  steps: number;
}

interface PiyoPlugin {
  requestSteps(): Promise<{ ok: boolean }>;
  dailySteps(o: { from: string }): Promise<{ days: StepDay[] }>;
  productPrice(): Promise<{ price: string | null }>;
  buy(): Promise<{ result: "ok" | "cancel" | "error" }>;
  restore(): Promise<{ result: "ok" | "none" | "error" }>;
  entitled(): Promise<{ owned: boolean }>;
  requestNotify(): Promise<{ ok: boolean }>;
  scheduleHungry(o: { at: number; name: string }): Promise<void>;
  pushWidget(o: { name: string; image: string; hunger: number; mood: number; away: boolean; at: number }): Promise<void>;
}

const Piyo = registerPlugin<PiyoPlugin>("Piyo");

export const isNative = () => Capacitor.isNativePlatform();

export async function requestSteps(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    return (await Piyo.requestSteps()).ok;
  } catch {
    return false;
  }
}

export async function dailySteps(from: string): Promise<StepDay[]> {
  if (!isNative()) return [];
  try {
    return (await Piyo.dailySteps({ from })).days;
  } catch {
    return [];
  }
}

export async function productPrice(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    return (await Piyo.productPrice()).price;
  } catch {
    return null;
  }
}

export async function buyUnlock(): Promise<"ok" | "cancel" | "error"> {
  if (!isNative()) return "ok";
  try {
    return (await Piyo.buy()).result;
  } catch {
    return "error";
  }
}

export async function restoreUnlock(): Promise<"ok" | "none" | "error"> {
  if (!isNative()) return "none";
  try {
    return (await Piyo.restore()).result;
  } catch {
    return "error";
  }
}

export async function isEntitled(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await Piyo.entitled()).owned;
  } catch {
    return false;
  }
}

export async function requestNotify(): Promise<void> {
  if (!isNative()) return;
  await Piyo.requestNotify().catch(() => undefined);
}

export async function scheduleHungry(at: number, name: string): Promise<void> {
  if (!isNative()) return;
  await Piyo.scheduleHungry({ at, name }).catch(() => undefined);
}

export async function pushWidget(o: { name: string; image: string; hunger: number; mood: number; away: boolean; at: number }): Promise<void> {
  if (!isNative()) return;
  await Piyo.pushWidget(o).catch(() => undefined);
}
