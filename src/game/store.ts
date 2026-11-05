import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pickScene, type SceneId } from "./scene";
import { dayLog, memoryLine, pruneHistory, type History } from "./memory";
import { addReps, claimSteps, clean, FREE_REPS_LIMIT, newPet, pat, isEgg, STAGES, stageOf, tick, type Ending, type Pet, type Stage } from "./rules";
import {
  BOND_TO_PROPOSE,
  canEat,
  eat,
  FOODS,
  goOut,
  OUTFITS,
  OUTINGS_PER_DAY,
  PLACES,
  placeOpen,
  REP_COINS,
  START_COINS,
  WEDDING_GIFT,
  type OutfitId,
  type OutingResult,
  type PlaceId,
} from "./economy";

export interface AlbumEntry {
  gen: number;
  name: string;
  reps: number;
  days: number;
  ending: Ending;
  endedAt: number;
  spouse?: string;
}

export type Overlay =
  | { kind: "name" }
  | { kind: "grew"; stage: Stage }
  | { kind: "ending"; ending: Ending; entry: AlbumEntry }
  | { kind: "askSteps" }
  | { kind: "delivery"; units: number }
  | { kind: "back" }
  | { kind: "paywall" };

export type Mode = "home" | "exercise" | "shop" | "food" | "outing";

export type BuyResult = "ok" | "full" | "poor";

interface GameState {
  pet: Pet;
  coins: number;
  owned: OutfitId[];
  /** しょうがいぶつ きょうそうの ベスト */
  playBest: number;
  wearing: OutfitId | null;
  album: AlbumEntry[];
  /** きょうの回数（日付キー付き） */
  today: { day: string; reps: number };
  outings: { day: string; n: number };
  seenHelp: boolean;
  /** つづきを 買った（次の 世代にも 引きつぐ） */
  unlocked: boolean;
  /** 課金の 入り口を 一度 見せた */
  paywallShown: boolean;
  /** 歩数の 案内を 出した */
  stepsAsked: boolean;
  /** 歩数を この日から 受け取る */
  stepsFrom: string | null;
  /** 日ごとに 受け取った 1000歩の 数 */
  stepsClaimed: Record<string, number>;
  /** はじめて ごはんを あげた（通知の 許可は そのあとで 聞く） */
  firstMeal: boolean;
  /** 日ごとの 記録。この子が 覚えている ひとことの もと */
  history: History;
  /** きょうの ひとこと */
  memo: { day: string; text: string } | null;
  /** 前に 見せた 場面と、前に ひらいた 時刻 */
  lastScene: SceneId | null;
  lastOpenAt: number;
  /** 保存しない一時状態 */
  scene: SceneId | null;
  mealOffer: boolean;
  offerMuted: boolean;
  eating: { id: string; at: number } | null;
  mode: Mode;
  overlays: Overlay[];
  speech: { text: string; at: number } | null;

  sync: (now?: number) => void;
  buyFood: (id: string) => BuyResult;
  buyOutfit: (id: OutfitId) => BuyResult;
  wear: (id: OutfitId | null) => void;
  doPat: () => void;
  doClean: () => boolean;
  exercise: (n: number) => void;
  goOuting: (id: PlaceId) => OutingResult | "poor" | "tired" | "closed";
  propose: () => boolean;
  finishPlay: (coins: number) => void;
  setName: (name: string) => void;
  closeOverlay: () => void;
  setMode: (m: Mode) => void;
  say: (text: string) => void;
  markHelpSeen: () => void;
  openDay: (now?: number) => void;
  openScene: (now?: number) => void;
  endScene: () => void;
  acceptMeal: () => void;
  declineMeal: () => void;
  graduate: () => void;
  answerSteps: (allowed: boolean) => void;
  receiveSteps: (totals: { day: string; steps: number }[]) => void;
  showPaywall: () => void;
  unlock: () => void;
  devAdvance: (hours: number) => void;
  resetAll: () => void;
}

export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function finish(s: GameState, pet: Pet, ending: Ending, now: number): Partial<GameState> {
  const entry: AlbumEntry = {
    gen: pet.gen,
    name: pet.name || "ななし",
    reps: pet.reps,
    days: Math.max(1, Math.round((now - pet.bornAt) / 86_400_000)),
    ending,
    endedAt: now,
    spouse: ending === "marry" ? pet.partner?.name : undefined,
  };
  return {
    pet: newPet(pet.gen + 1, now, !s.unlocked),
    album: [entry, ...s.album],
    coins: s.coins + (ending === "marry" ? WEDDING_GIFT : 0),
    overlays: [...s.overlays, { kind: "ending", ending, entry }],
    mode: "home",
  };
}

/** おにぎりが 買えて、まだ たべられて、この子が 家に いる */
const offerable = (pet: Pet, coins: number, muted: boolean) =>
  !muted && !isEgg(pet) && !pet.away && coins >= FOODS[0].price && pet.hunger < 90;

const restartEgg = (pet: Pet): Pet => ({ ...pet, bornAt: Date.now(), lastTick: Date.now() });

export const outingsLeft = (s: Pick<GameState, "outings">) =>
  OUTINGS_PER_DAY - (s.outings.day === dayKey(Date.now()) ? s.outings.n : 0);

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      pet: newPet(1, Date.now()),
      coins: START_COINS,
      owned: [],
      playBest: 0,
      wearing: null,
      album: [],
      today: { day: dayKey(Date.now()), reps: 0 },
      outings: { day: dayKey(Date.now()), n: 0 },
      seenHelp: false,
      unlocked: false,
      paywallShown: false,
      stepsAsked: false,
      stepsFrom: null,
      stepsClaimed: {},
      firstMeal: false,
      history: {},
      memo: null,
      lastScene: null,
      lastOpenAt: 0,
      scene: null,
      mealOffer: false,
      offerMuted: false,
      eating: null,
      mode: "home",
      overlays: [],
      speech: null,

      sync: (now = Date.now()) => {
        const s = get();
        // 遊び方や エンディングを 読んでいる あいだは たまごを かえさない（とじてから 10秒）
        if (isEgg(s.pet) && (!s.seenHelp || s.overlays.length > 0)) return;
        const r = tick(s.pet, now);
        // かえったら おいわいして 名前を つける
        const overlays: Overlay[] = r.hatched ? [...s.overlays, { kind: "grew", stage: STAGES[0] }, { kind: "name" }] : s.overlays;
        if (r.ending) {
          set({ ...finish({ ...s, overlays }, r.pet, r.ending, now) });
          return;
        }
        if (r.pet !== s.pet) set({ pet: r.pet, overlays });
      },

      buyFood: (id) => {
        get().sync();
        const s = get();
        const f = FOODS.find((x) => x.id === id);
        if (!f || isEgg(s.pet)) return "full";
        if (!canEat(s.pet, f)) return "full";
        if (s.coins < f.price) return "poor";
        set({ pet: eat(s.pet, f), coins: s.coins - f.price, firstMeal: true, eating: { id, at: Date.now() } });
        return "ok";
      },

      buyOutfit: (id) => {
        const s = get();
        const o = OUTFITS.find((x) => x.id === id);
        if (!o || s.owned.includes(id)) return "ok";
        if (s.coins < o.price) return "poor";
        set({ coins: s.coins - o.price, owned: [...s.owned, id], wearing: id });
        return "ok";
      },

      wear: (id) => {
        if (id == null || get().owned.includes(id)) set({ wearing: id });
      },

      doPat: () => {
        get().sync();
        set({ pet: pat(get().pet) });
      },

      doClean: () => {
        get().sync();
        if (get().pet.poops === 0) return false;
        set({ pet: clean(get().pet) });
        return true;
      },

      exercise: (n) => {
        const now = Date.now();
        get().sync(now);
        const s = get();
        const r = addReps(s.pet, n, now);
        const day = dayKey(now);
        const today = s.today.day === day ? { day, reps: s.today.reps + n } : { day, reps: n };
        const overlays = [...s.overlays];
        if (r.cameBack) overlays.push({ kind: "back" });
        if (r.grew) overlays.push({ kind: "grew", stage: r.grew });
        const crossed = !s.paywallShown && r.pet.locked && r.pet.reps >= FREE_REPS_LIMIT;
        if (crossed) overlays.push({ kind: "paywall" });
        const coins = s.coins + REP_COINS * n;
        const log = dayLog(s.history, day);
        set({
          pet: r.pet,
          today,
          overlays,
          coins,
          paywallShown: s.paywallShown || !!crossed,
          history: { ...s.history, [day]: { ...log, reps: log.reps + n } },
          mealOffer: offerable(r.pet, coins, s.offerMuted),
        });
      },

      // ごはん代が たまった 瞬間に、その場で あげられる
      acceptMeal: () => {
        const s = get();
        const r = s.buyFood(FOODS[0].id);
        set({ mealOffer: false, mode: r === "ok" ? "home" : s.mode, speech: r === "ok" ? { text: "もぐもぐ…おいしい！", at: Date.now() } : s.speech });
      },
      declineMeal: () => set({ mealOffer: false, offerMuted: true }),

      // 30分 以上 あいて ひらいたら、この子は もう 何かを している
      openScene: (now = Date.now()) => {
        get().sync(now);
        const s = get();
        const gap = now - s.lastOpenAt;
        if (gap < 30 * 60_000) {
          set({ lastOpenAt: now });
          return;
        }
        const scene = s.mode === "home" ? pickScene(s.pet, new Date(now).getHours(), s.lastScene, Math.random()) : null;
        set({ lastOpenAt: now, scene, lastScene: scene ?? s.lastScene });
      },
      endScene: () => set({ scene: null }),

      // その日 はじめて ひらいた ときだけ 覚えていることを 言う
      openDay: (now = Date.now()) => {
        const s = get();
        const day = dayKey(now);
        const log = dayLog(s.history, day);
        if (log.hour != null) return;
        const text = isEgg(s.pet) ? null : memoryLine(s.history, now);
        set({
          history: pruneHistory({ ...s.history, [day]: { ...log, hour: new Date(now).getHours() } }, now),
          memo: text ? { day, text } : null,
        });
      },

      // ひとりだちは 自分で きめる（時間で いなくならない）
      graduate: () => {
        const now = Date.now();
        get().sync(now);
        const s = get();
        if (stageOf(s.pet).id !== "adult" || s.pet.away) return;
        set(finish(s, s.pet, "leave", now));
      },

      answerSteps: (allowed) =>
        set({ stepsAsked: true, stepsFrom: allowed ? dayKey(Date.now()) : get().stepsFrom }),

      receiveSteps: (totals) => {
        get().sync();
        const s = get();
        if (!s.stepsFrom || isEgg(s.pet)) return;
        const r = claimSteps(s.stepsClaimed, totals);
        if (r.units <= 0) return;
        const now = Date.now();
        const g = addReps(s.pet, r.units, now);
        const overlays: Overlay[] = [...s.overlays, { kind: "delivery", units: r.units }];
        if (g.cameBack) overlays.push({ kind: "back" });
        if (g.grew) overlays.push({ kind: "grew", stage: g.grew });
        const crossed = !s.paywallShown && g.pet.locked && g.pet.reps >= FREE_REPS_LIMIT;
        if (crossed) overlays.push({ kind: "paywall" });
        // 2週間より 前の 記録は 要らないので 捨てる
        const keep = new Set(Array.from({ length: 14 }, (_, i) => dayKey(now - i * 86_400_000)));
        const stepsClaimed = Object.fromEntries(Object.entries(r.claimed).filter(([d]) => keep.has(d)));
        const history = { ...s.history };
        for (const { day } of totals) {
          const gain = (r.claimed[day] ?? 0) - (s.stepsClaimed[day] ?? 0);
          if (gain > 0) {
            const log = dayLog(history, day);
            history[day] = { ...log, units: log.units + gain };
          }
        }
        const coins = s.coins + REP_COINS * r.units;
        set({
          pet: g.pet,
          coins,
          stepsClaimed,
          overlays,
          history: pruneHistory(history, now),
          paywallShown: s.paywallShown || !!crossed,
          offerMuted: false,
          mealOffer: offerable(g.pet, coins, false),
        });
      },

      showPaywall: () => {
        const s = get();
        if (s.overlays.some((o) => o.kind === "paywall")) return;
        set({ overlays: [...s.overlays, { kind: "paywall" }], paywallShown: true });
      },

      unlock: () => {
        const s = get();
        const before = stageOf(s.pet);
        const pet: Pet = { ...s.pet, locked: false };
        const after = stageOf(pet);
        if (after.id === "adult" && pet.adultAt == null) pet.adultAt = Date.now();
        const overlays = s.overlays.filter((o) => o.kind !== "paywall");
        if (after.id !== before.id) overlays.push({ kind: "grew", stage: after });
        set({ unlocked: true, pet, overlays });
      },

      // 試作の ブラウザ版だけで つかう。時間を すすめる
      devAdvance: (hours) => {
        const s = get();
        const ms = hours * 3_600_000;
        const shift = <T,>(o: Record<string, T>) => {
          const now = Date.now();
          const back: Record<string, T> = {};
          for (let i = 0; i < 40; i++) {
            const v = o[dayKey(now - i * 86_400_000)];
            if (v !== undefined) back[dayKey(now - i * 86_400_000 - ms)] = v;
          }
          return back;
        };
        set({
          pet: { ...s.pet, lastTick: s.pet.lastTick - ms, bornAt: s.pet.bornAt - ms, adultAt: s.pet.adultAt ? s.pet.adultAt - ms : s.pet.adultAt, zeroSince: s.pet.zeroSince ? s.pet.zeroSince - ms : s.pet.zeroSince, away: s.pet.away ? { ...s.pet.away, since: s.pet.away.since - ms } : s.pet.away },
          history: shift(s.history),
          stepsClaimed: shift(s.stepsClaimed),
        });
        get().sync();
        useGame.setState({ lastOpenAt: 0 });
        get().openScene();
        get().openDay();
      },

      goOuting: (id) => {
        get().sync();
        const s = get();
        const place = PLACES.find((p) => p.id === id)!;
        if (s.pet.away) return "closed";
        if (!placeOpen(s.pet, place)) return "closed";
        if (outingsLeft(s) <= 0) return "tired";
        if (s.coins < place.price) return "poor";
        const r = goOut(s.pet, place, Math.random());
        const day = dayKey(Date.now());
        set({
          pet: r.pet,
          coins: s.coins - place.price + r.coins,
          outings: { day, n: (s.outings.day === day ? s.outings.n : 0) + 1 },
        });
        return r;
      },

      finishPlay: (coins) => {
        get().sync();
        const s = get();
        const mood = Math.min(100, s.pet.mood + 10);
        set({
          coins: s.coins + coins,
          playBest: Math.max(s.playBest, coins),
          pet: { ...s.pet, mood, zeroSince: mood > 0 && s.pet.hunger > 0 ? null : s.pet.zeroSince },
        });
      },

      propose: () => {
        const s = get();
        if ((s.pet.partner?.bond ?? 0) < BOND_TO_PROPOSE) return false;
        set(finish(s, s.pet, "marry", Date.now()));
        return true;
      },

      setName: (name) => set({ pet: { ...get().pet, name } }),
      closeOverlay: () => {
        const s = get();
        const closed = s.overlays[0];
        // なまえを つけたら 歩数の 案内
        if (closed?.kind === "name" && !s.stepsAsked) {
          set({ overlays: [{ kind: "askSteps" }, ...s.overlays.slice(1)] });
          return;
        }
        // エンディングを とじた ときから 次の たまごの 10秒を かぞえる
        const pet = closed?.kind === "ending" && isEgg(s.pet) ? restartEgg(s.pet) : s.pet;
        set({ overlays: s.overlays.slice(1), pet });
      },
      setMode: (mode) => set(mode === "exercise" ? { mode, offerMuted: false, scene: null } : mode === "home" ? { mode } : { mode, scene: null }),
      say: (text) => set({ speech: { text, at: Date.now() } }),
      // はじめての 遊び方を とじた ときから たまごの 10秒を かぞえる
      markHelpSeen: () => set({ seenHelp: true, pet: isEgg(get().pet) ? restartEgg(get().pet) : get().pet }),
      resetAll: () =>
        set({
          pet: newPet(1, Date.now(), !get().unlocked),
          stepsAsked: false,
          stepsFrom: null,
          stepsClaimed: {},
          paywallShown: false,
          firstMeal: false,
          history: {},
          memo: null,
          lastScene: null,
          lastOpenAt: 0,
          scene: null,
          mealOffer: false,
          offerMuted: false,
          coins: START_COINS,
          owned: [],
          playBest: 0,
          wearing: null,
          album: [],
          today: { day: dayKey(Date.now()), reps: 0 },
          outings: { day: dayKey(Date.now()), n: 0 },
          overlays: [],
          speech: null,
          mode: "home",
        }),
    }),
    {
      name: "mini-piyofit-v1",
      version: 4,
      partialize: (s) => ({
        pet: s.pet,
        coins: s.coins,
        owned: s.owned,
        playBest: s.playBest,
        wearing: s.wearing,
        album: s.album,
        today: s.today,
        outings: s.outings,
        seenHelp: s.seenHelp,
        unlocked: s.unlocked,
        paywallShown: s.paywallShown,
        stepsAsked: s.stepsAsked,
        stepsFrom: s.stepsFrom,
        stepsClaimed: s.stepsClaimed,
        firstMeal: s.firstMeal,
        history: s.history,
        memo: s.memo,
        lastScene: s.lastScene,
        lastOpenAt: s.lastOpenAt,
      }),
      // v1（コインなし版）を あそんでいた人には はじめの コインを わたす
      migrate: (old, version) => {
        const o = (old ?? {}) as Record<string, unknown>;
        let next = o;
        if (version < 2) {
          next = { ...next, coins: START_COINS, owned: [], wearing: null, outings: { day: dayKey(Date.now()), n: 0 } };
        }
        // v3: ふ化が 回数式から 時間式に。10回 以上 うごいた子は もう かえっている
        if (version < 3 && next.pet) {
          const pet = next.pet as Pet;
          next = { ...next, pet: { ...pet, hatchedAt: pet.reps >= 10 ? pet.bornAt : null } };
        }
        // v4: いえでで 消えなくなった。課金の 入り口を 追加
        if (version < 4 && next.pet) {
          next = { ...next, pet: { ...(next.pet as Pet), locked: true, away: null }, unlocked: false };
        }
        return next;
      },
    },
  ),
);

export function todayReps(s: Pick<GameState, "today">): number {
  return s.today.day === dayKey(Date.now()) ? s.today.reps : 0;
}

if (import.meta.env.DEV) {
  (window as unknown as { __mini: typeof useGame }).__mini = useGame;
}
