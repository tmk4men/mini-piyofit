// ミニぴよふぃっと のルール。状態は数値だけ、時間経過は tick() の純関数で進める。

export const HOUR = 3600_000;

/** おなか 100→0 にかかる時間 */
export const HUNGER_EMPTY_H = 16;
/** きげん 100→0 にかかる時間（うんちがあると 1個ごとに 1.5倍速くなる） */
export const MOOD_EMPTY_H = 24;
export const POOP_EVERY_H = 4;
export const POOP_MAX = 3;
/** おなか か きげん が 0 になったら すぐ いえで（待ち時間なし） */
export const RUNAWAY_AFTER_H = 0;
/** おとなになってから（けっこん しなければ）ひとりだちするまで */
export const LEAVE_AFTER_H = 72;

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

export const EGG: Stage = { id: "egg", label: "たまご", at: 0, img: "/piyo_egg.webp" };

/** かえってからの 段階。回数（そだち）で あがる */
export const STAGES: Stage[] = [
  { id: "hiyoko", label: "ひよこ", at: 0, img: "/piyo.webp" },
  { id: "kinder", label: "ようちえん", at: 40, img: "/piyo_child.webp" },
  { id: "elementary", label: "しょうがくせい", at: 100, img: "/piyo_student.webp" },
  { id: "junior", label: "ちゅうがくせい", at: 180, img: "/piyo_teen.webp" },
  { id: "high", label: "こうこうせい", at: 280, img: "/piyo_youth.webp" },
  { id: "adult", label: "おとな", at: 400, img: "/piyo_graduated.webp" },
];

export function stageFor(reps: number): Stage {
  let s = STAGES[0];
  for (const st of STAGES) if (reps >= st.at) s = st;
  return s;
}

export function nextStage(reps: number): Stage | null {
  return STAGES.find((s) => s.at > reps) ?? null;
}

export const isEgg = (pet: Pet) => pet.hatchedAt == null;

/** いまの 段階（たまごの あいだは たまご） */
export function stageOf(pet: Pet): Stage {
  return isEgg(pet) ? EGG : stageFor(pet.reps);
}

export function nextStageOf(pet: Pet): Stage | null {
  return isEgg(pet) ? STAGES[0] : nextStage(pet.reps);
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
}

export type Ending = "leave" | "runaway" | "marry";

export function newPet(gen: number, now: number): Pet {
  return {
    gen,
    name: "",
    bornAt: now,
    hatchedAt: null,
    reps: 0,
    hunger: 80,
    mood: 80,
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
    p.hunger = clamp(p.hunger - (100 / HUNGER_EMPTY_H) * h);
    p.mood = clamp(p.mood - (100 / MOOD_EMPTY_H) * h * (1 + 0.5 * p.poops));
    p.poopClock += dt;
    while (p.poopClock >= POOP_EVERY_H * HOUR) {
      p.poopClock -= POOP_EVERY_H * HOUR;
      p.poops = Math.min(POOP_MAX, p.poops + 1);
    }
    const zero = p.hunger <= 0 || p.mood <= 0;
    if (zero && p.zeroSince == null) p.zeroSince = t;
    if (!zero) p.zeroSince = null;
    if (p.zeroSince != null && t - p.zeroSince >= RUNAWAY_AFTER_H * HOUR) {
      p.lastTick = t;
      return { pet: p, ending: "runaway", hatched };
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
export function addReps(pet: Pet, n: number, now: number): { pet: Pet; grew: Stage | null } {
  const before = stageOf(pet);
  const reps = pet.reps + n;
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
