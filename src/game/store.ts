import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addReps, clean, newPet, pat, isEgg, STAGES, tick, type Ending, type Pet, type Stage } from "./rules";
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
  | { kind: "ending"; ending: Ending; entry: AlbumEntry };

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
  /** 保存しない一時状態 */
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
    pet: newPet(pet.gen + 1, now),
    album: [entry, ...s.album],
    coins: s.coins + (ending === "marry" ? WEDDING_GIFT : 0),
    overlays: [...s.overlays, { kind: "ending", ending, entry }],
    mode: "home",
  };
}

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
        set({ pet: eat(s.pet, f), coins: s.coins - f.price });
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
        if (r.grew) overlays.push({ kind: "grew", stage: r.grew });
        set({ pet: r.pet, today, overlays, coins: s.coins + REP_COINS * n });
      },

      goOuting: (id) => {
        get().sync();
        const s = get();
        const place = PLACES.find((p) => p.id === id)!;
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
        // エンディングを とじた ときから 次の たまごの 10秒を かぞえる
        const pet = closed?.kind === "ending" && isEgg(s.pet) ? restartEgg(s.pet) : s.pet;
        set({ overlays: s.overlays.slice(1), pet });
      },
      setMode: (mode) => set({ mode }),
      say: (text) => set({ speech: { text, at: Date.now() } }),
      // はじめての 遊び方を とじた ときから たまごの 10秒を かぞえる
      markHelpSeen: () => set({ seenHelp: true, pet: isEgg(get().pet) ? restartEgg(get().pet) : get().pet }),
      resetAll: () =>
        set({
          pet: newPet(1, Date.now()),
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
      version: 3,
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
