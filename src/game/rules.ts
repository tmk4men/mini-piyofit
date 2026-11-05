// ミニぴよふぃっと のルール。状態は数値だけ、時間経過は tick() の純関数で進める。

export const HOUR = 3600_000;

/** おなか 100→0 にかかる時間 */
export const HUNGER_EMPTY_H = 48;
/** きげん 100→0 にかかる時間（うんちがあると 1個ごとに 1.5倍速くなる） */
export const MOOD_EMPTY_H = 120;
export const POOP_EVERY_H = 8;
export const POOP_MAX = 3;
/** おなか か きげん が 0 のまま これだけ たつと、おでかけして 手紙を のこす（いなくなりは しない） */
export const AWAY_AFTER_H = 48;
/** うんどう（または 歩数）これだけで むかえに いける */
export const COMEBACK_REPS = 5;
/** おとなになってから（けっこん しなければ）ひとりだちするまで */
export const LEAVE_AFTER_H = 168;
/** 無料で そだつのは ここの 手前まで。回数は ためたまま */
export const FREE_REPS_LIMIT = 100;
/** 1000歩で 1かいぶん。1日 10かいぶんまで */
export const STEPS_PER_UNIT = 1000;
export const MAX_STEP_UNITS_PER_DAY = 10;

export const FEED_HUNGER = 30;
export const FULL_AT = 90;
export const PET_MOOD = 4;
export const REP_MOOD = 1;
export const REP_HUNGER = 0.5;
/** たまごを むかえてから かえるまで */
export const HATCH_AFTER_MS = 10_000;

export type StageId = "egg" | "hiyoko" | "kinder" | "elementary" | "junior" | "high" | "adult";

export interface Stage {
  id: StageId;
  label: string;
  /** この段階になる累計回数 */
  at: number;
  img: string;
}

export const EGG: Stage = { id: "egg", label: "たまご", at: 0, img: "piyo_egg.webp" };

/** かえってからの 段階。回数（そだち）で あがる */
export const STAGES: Stage[] = [
  { id: "hiyoko", label: "ひよこ", at: 0, img: "piyo.webp" },
  { id: "kinder", label: "ようちえん", at: 40, img: "piyo_child.webp" },
  { id: "elementary", label: "しょうがくせい", at: 100, img: "piyo_student.webp" },
  { id: "junior", label: "ちゅうがくせい", at: 180, img: "piyo_teen.webp" },
  { id: "high", label: "こうこうせい", at: 280, img: "piyo_youth.webp" },
  { id: "adult", label: "おとな", at: 400, img: "piyo_graduated.webp" },
];

export function stageFor(reps: number): Stage {
  let s = STAGES[0];
  for (const st of STAGES) if (reps >= st.at) s = st;
  return s;
}

export function nextStage(reps: number): Stage | null {
  return STAGES.find((s) => s.at > reps) ?? null;
}

/** そだちに つかう 回数。買う前は 無料の 手前で 止まる（本当の 回数は のこる） */
export const growthReps = (pet: Pick<Pet, "reps" | "locked">) =>
  pet.locked ? Math.min(pet.reps, FREE_REPS_LIMIT - 1) : pet.reps;

/** つづきを 買えば 先に すすめる 状態 */
export const isAtPaywall = (pet: Pick<Pet, "reps" | "locked" | "hatchedAt">) =>
  !!pet.locked && pet.hatchedAt != null && pet.reps >= FREE_REPS_LIMIT - 1;

export const isEgg = (pet: Pet) => pet.hatchedAt == null;

/** いまの 段階（たまごの あいだは たまご） */
export function stageOf(pet: Pet): Stage {
  return isEgg(pet) ? EGG : stageFor(growthReps(pet));
}

export function nextStageOf(pet: Pet): Stage | null {
  return isEgg(pet) ? STAGES[0] : nextStage(growthReps(pet));
}

export interface Pet {
  gen: number;
  name: string;
  /** たまごの あいだは たまごを むかえた時刻、かえったら かえった時刻 */
  bornAt: number;
  /** かえった時刻。たまごの あいだは null */
  hatchedAt: number | null;
  /** 累計回数＝そだち */
  reps: number;
  hunger: number;
  mood: number;
  poops: number;
  /** 前のうんちからの経過（ミリ秒） */
  poopClock: number;
  /** おなか か きげん が 0 になった時刻。どちらも 0 でなければ null */
  zeroSince: number | null;
  adultAt: number | null;
  lastTick: number;
  /** おとなに なってから であった あいて */
  partner?: { name: string; bond: number } | null;
  /** 買う前は true。そだちが 無料の 手前で 止まる */
  locked?: boolean;
  /** おでかけ中。reps は むかえに いく ぶんの 回数 */
  away?: { since: number; reps: number } | null;
}

export type Ending = "leave" | "runaway" | "marry";

export function newPet(gen: number, now: number, locked = true): Pet {
  return {
    gen,
    name: "",
    bornAt: now,
    hatchedAt: null,
    reps: 0,
    hunger: 70,
    mood: 80,
    locked,
    away: null,
    poops: 0,
    poopClock: 0,
    zeroSince: null,
    adultAt: null,
    lastTick: now,
  };
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/**
 * now まで時間を進める。長い放置も 10分刻みで回すので、
 * 途中で 0 になった時刻を正しく拾える。
 */
export function tick(pet: Pet, now: number): { pet: Pet; ending: Ending | null; hatched: boolean } {
  if (now <= pet.lastTick) return { pet, ending: null, hatched: false };
  const p = { ...pet };
  let hatched = false;
  // たまごは 何も減らない。むかえて 10秒で かえり、そこから 時間が動き出す
  if (isEgg(p)) {
    const at = p.bornAt + HATCH_AFTER_MS;
    if (now < at) {
      p.lastTick = now;
      return { pet: p, ending: null, hatched: false };
    }
    p.hatchedAt = at;
    p.bornAt = at;
    p.lastTick = at;
    hatched = true;
  }
  const STEP = 10 * 60_000;
  let t = p.lastTick;
  while (t < now) {
    const dt = Math.min(STEP, now - t);
    t += dt;
    const h = dt / HOUR;
    // おでかけ中は おなかも きげんも 減らない
    if (p.away) continue;
    p.hunger = clamp(p.hunger - (100 / HUNGER_EMPTY_H) * h);
    p.mood = clamp(p.mood - (100 / MOOD_EMPTY_H) * h * (1 + 0.25 * p.poops));
    p.poopClock += dt;
    while (p.poopClock >= POOP_EVERY_H * HOUR) {
      p.poopClock -= POOP_EVERY_H * HOUR;
      p.poops = Math.min(POOP_MAX, p.poops + 1);
    }
    const zero = p.hunger <= 0 || p.mood <= 0;
    if (zero && p.zeroSince == null) p.zeroSince = t;
    if (!zero) p.zeroSince = null;
    if (p.zeroSince != null && t - p.zeroSince >= AWAY_AFTER_H * HOUR) {
      p.away = { since: t, reps: 0 };
      p.zeroSince = null;
      continue;
    }
    if (p.adultAt != null && t - p.adultAt >= LEAVE_AFTER_H * HOUR) {
      p.lastTick = t;
      return { pet: p, ending: "leave", hatched };
    }
  }
  p.lastTick = now;
  return { pet: p, ending: null, hatched };
}

export function feed(pet: Pet): { pet: Pet; ok: boolean } {
  if (pet.hunger >= FULL_AT) return { pet, ok: false };
  const hunger = clamp(pet.hunger + FEED_HUNGER);
  return { pet: { ...pet, hunger, mood: clamp(pet.mood + 3), zeroSince: hunger > 0 && pet.mood > 0 ? null : pet.zeroSince }, ok: true };
}

export function pat(pet: Pet): Pet {
  const mood = clamp(pet.mood + PET_MOOD);
  return { ...pet, mood, zeroSince: mood > 0 && pet.hunger > 0 ? null : pet.zeroSince };
}

export function clean(pet: Pet): Pet {
  return { ...pet, poops: 0, poopClock: 0 };
}

/** n 回ぶん運動した。段階が上がったら新しい段階を返す */
export function addReps(pet: Pet, n: number, now: number): { pet: Pet; grew: Stage | null; cameBack?: boolean } {
  const before = stageOf(pet);
  const reps = pet.reps + n;
  if (pet.away) {
    const got = pet.away.reps + n;
    if (got < COMEBACK_REPS) return { pet: { ...pet, reps, away: { ...pet.away, reps: got } }, grew: null };
    // むかえに きてくれたので かえってくる。そだちは そのまま
    const home: Pet = { ...pet, reps, away: null, hunger: Math.max(pet.hunger, 60), mood: Math.max(pet.mood, 60), poops: 0, poopClock: 0, zeroSince: null };
    const after = stageOf(home);
    if (after.id === "adult" && home.adultAt == null) home.adultAt = now;
    return { pet: home, grew: after.id !== before.id ? after : null, cameBack: true };
  }
  const after = stageOf({ ...pet, reps });
  // うんどうで おなかは へるが、うんどうで いえで させない（1 より下げない）
  const hunger = Math.max(Math.min(pet.hunger, 1), clamp(pet.hunger - REP_HUNGER * n));
  const mood = clamp(pet.mood + REP_MOOD * n);
  const p: Pet = {
    ...pet,
    reps,
    hunger,
    mood,
    zeroSince: hunger > 0 && mood > 0 ? null : pet.zeroSince,
  };
  if (after.id === "adult" && p.adultAt == null) p.adultAt = now;
  return { pet: p, grew: after.id !== before.id ? after : null };
}

/** ハート 0〜4 個 */
export function hearts(v: number): number {
  return Math.ceil(clamp(v) / 25);
}

export function ageDays(pet: Pet, now: number): number {
  return Math.floor((now - pet.bornAt) / (24 * HOUR)) + 1;
}

/** その日の 歩数から、まだ 受け取っていない 1000歩ぶんを 数える。同じ 歩数は 二度 もらえない */
export function claimSteps(
  claimed: Record<string, number>,
  totals: { day: string; steps: number }[],
): { units: number; claimed: Record<string, number> } {
  const next = { ...claimed };
  let units = 0;
  for (const { day, steps } of totals) {
    const have = Math.min(MAX_STEP_UNITS_PER_DAY, Math.floor(Math.max(0, steps) / STEPS_PER_UNIT));
    const gain = have - (next[day] ?? 0);
    if (gain > 0) {
      units += gain;
      next[day] = have;
    }
  }
  return { units, claimed: next };
}
