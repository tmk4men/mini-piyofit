import { useEffect, useRef, useState } from "react";
import { useGame, todayReps } from "../game/store";
import { COMEBACK_REPS, growthReps, HATCH_AFTER_MS, hearts, isAtPaywall, nextStageOf, stageFor, stageOf } from "../game/rules";
import { FOODS, REP_COINS } from "../game/economy";
import { idleLine } from "../game/lines";
import { IconBento, IconCake, IconHand, IconHeart, IconOnigiri, IconSparkle } from "./icons";
import { PetFigure } from "./PetFigure";
import { asset } from "../asset";

function Hearts({ label, value }: { label: string; value: number }) {
  const n = hearts(value);
  return (
    <div className="meter" aria-label={`${label} ${n}/4`}>
      <span className="meter-label">{label}</span>
      <span className={`meter-hearts${n <= 1 ? " is-low" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <IconHeart key={i} size={18} filled={i < n} />
        ))}
      </span>
    </div>
  );
}

/** あるける 範囲（ぴよこの まんなかの 位置、画面の 幅に たいする %） */
const WALK_MIN = 30;
const WALK_MAX = 70;
/** 1% すすむのに かかる 時間 */
const WALK_MS_PER_PERCENT = 110;
const REDUCED_MOTION = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const POOP_SPOTS = [
  { left: "14%", bottom: "16%" },
  { left: "74%", bottom: "12%" },
  { left: "22%", bottom: "4%" },
];

export function Room({ onPat }: { onPat: () => void }) {
  const pet = useGame((s) => s.pet);
  const speech = useGame((s) => s.speech);
  const today = useGame(todayReps);
  const coins = useGame((s) => s.coins);
  const memo = useGame((s) => s.memo);
  const eating = useGame((s) => s.eating);
  const blockedByCard = useGame((s) => s.overlays.length > 0 || s.mealOffer);
  const showPaywall = useGame((s) => s.showPaywall);
  const stage = stageOf(pet);
  const next = nextStageOf(pet);
  const [floaters, setFloaters] = useState<{ id: number; x: number; dx: number; delay: number; kind: "heart" | "sparkle" }[]>([]);
  const [bump, setBump] = useState(0);
  const idRef = useRef(0);

  // 吹き出し: 直近の反応があれば それを、なければ 状態に応じた ひとこと
  const [idle, setIdle] = useState(() => idleLine(pet));
  useEffect(() => {
    setIdle(idleLine(pet));
    const t = setInterval(() => setIdle(idleLine(useGame.getState().pet)), 9000);
    return () => clearInterval(t);
    // 困りごとが変わった時だけ 言い直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id, pet.hunger < 10, pet.mood < 10, pet.hunger < 25, pet.mood < 25, pet.poops]);
  const fresh = speech && Date.now() - speech.at < 3500;
  const [, force] = useState(0);
  useEffect(() => {
    if (!speech) return;
    const t = setTimeout(() => force((x) => x + 1), 3600);
    return () => clearTimeout(t);
  }, [speech]);
  // きょうの ひとことは、カードが 閉じてから 25秒 見せる
  const [memoUntil, setMemoUntil] = useState(0);
  const memoShown = useRef<string | null>(null);
  useEffect(() => {
    if (!memo || blockedByCard || memoShown.current === memo.day) return;
    memoShown.current = memo.day;
    setMemoUntil(Date.now() + 25000);
    const t = setTimeout(() => setMemoUntil(0), 25000);
    return () => clearTimeout(t);
  }, [memo, blockedByCard]);
  const line = fresh ? speech!.text : memo && memoUntil > Date.now() ? memo.text : idle;

  // ごはんを たべる ところを 見せる
  const [meal, setMeal] = useState<string | null>(null);
  useEffect(() => {
    if (!eating || Date.now() - eating.at > 1500) return;
    setMeal(eating.id);
    setBump((b) => b + 1);
    const t = setTimeout(() => setMeal(null), 1300);
    return () => clearTimeout(t);
  }, [eating]);

  const isEgg = stage.id === "egg";
  const weak = !isEgg && (pet.hunger < 10 || pet.mood < 10);
  const grown = growthReps(pet);
  const prevFloor = next ? stageFor(grown).at : 0;
  const mealPrice = FOODS[0].price;
  const needMeal = !isEgg && !pet.away && coins < mealPrice;
  const paywall = !isEgg && isAtPaywall(pet);
  // たまごの あいだは かえるまでの 時間で バーを すすめる
  const progress = isEgg
    ? Math.min(1, Math.max(0, (pet.lastTick - pet.bornAt) / HATCH_AFTER_MS))
    : next
      ? (grown - prevFloor) / (next.at - prevFloor)
      : 1;
  const barValue = pet.away ? pet.away.reps / COMEBACK_REPS : needMeal ? coins / mealPrice : progress;

  // 部屋の なかを あるきまわる。たまご・げんきが ない とき・動きを へらす 設定 では まんなかに いる
  const petRef = useRef<HTMLButtonElement>(null);
  const [walk, setWalk] = useState({ x: 50, ms: 0, walking: false, facing: 1 });
  const xRef = useRef(50);
  const pauseUntil = useRef(0);
  const still = isEgg || weak || !!pet.away || REDUCED_MOTION;
  useEffect(() => {
    if (still) {
      xRef.current = 50;
      setWalk({ x: 50, ms: 600, walking: false, facing: 1 });
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      if (Date.now() < pauseUntil.current) {
        t = setTimeout(next, 600);
        return;
      }
      const from = xRef.current;
      let to = WALK_MIN + Math.random() * (WALK_MAX - WALK_MIN);
      if (Math.abs(to - from) < 10) to = from < 50 ? from + 18 : from - 18;
      const ms = Math.abs(to - from) * WALK_MS_PER_PERCENT;
      xRef.current = to;
      setWalk({ x: to, ms, walking: true, facing: to < from ? -1 : 1 });
      t = setTimeout(() => {
        setWalk((w) => ({ ...w, walking: false }));
        t = setTimeout(next, 1500 + Math.random() * 3500);
      }, ms);
    };
    t = setTimeout(next, 1500);
    return () => clearTimeout(t);
  }, [still]);

  const tap = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const id = ++idRef.current;
    // よろこびの ハートを 3つと きらきらを 1つ、はじけるように だす
    const x = e.clientX - r.left;
    const burst = [
      { dx: -26, delay: 0, kind: "heart" as const },
      { dx: 4, delay: 90, kind: "heart" as const },
      { dx: 30, delay: 170, kind: "heart" as const },
      { dx: -6, delay: 60, kind: "sparkle" as const },
    ].map((b, i) => ({ ...b, id: id * 10 + i, x }));
    setFloaters((f) => [...f, ...burst]);
    setTimeout(() => setFloaters((f) => f.filter((v) => !burst.some((b) => b.id === v.id))), 1300);
    setBump((b) => b + 1);
    // なでられたら その場で 立ちどまって ゆれる
    const area = petRef.current?.parentElement?.getBoundingClientRect();
    if (area && walk.walking) {
      const here = ((r.left + r.width / 2 - area.left) / area.width) * 100;
      xRef.current = here;
      setWalk((w) => ({ ...w, x: here, ms: 0, walking: false }));
    }
    pauseUntil.current = Date.now() + 2500;
    onPat();
  };

  return (
    <div className="room">
      <div className="stage-area">
        {pet.away ? (
          <div className="away-note" role="img" aria-label="さがさないでね の 手紙">
            <div className="letter" aria-hidden="true"><span>むかえに きてね</span></div>
          </div>
        ) : (
        <>
        <p className="bubble" key={line}>
          {line}
        </p>

        {POOP_SPOTS.slice(0, pet.poops).map((p, i) => (
          <img key={`poop${i}`} className="poop" src={asset("piyo_poop.webp")} alt="うんち" style={p} />
        ))}

        <button
          ref={petRef}
          type="button"
          className={`pet${weak ? " is-weak" : ""}${isEgg ? " is-egg" : ""}${!isEgg && (pet.hunger <= 0 || pet.mood <= 0) ? " is-waiting" : ""}`}
          onPointerDown={tap}
          aria-label={isEgg ? "たまごを なでる" : "なでる"}
          style={{ left: `${walk.x}%`, transitionDuration: `${walk.ms}ms` }}
        >
          <span className={`pet-face${walk.facing < 0 ? " is-left" : ""}`}>
            <span key={`sway${bump}`} className={`pet-sway${bump > 0 ? " is-swaying" : ""}`}>
              <PetFigure className={`pet-img${walk.walking ? " is-walking" : ""}`} />
            </span>
          </span>
          {meal && (
            <span className="eat-food" aria-hidden="true">
              {meal === "bento" ? <IconBento size={46} /> : meal === "cake" ? <IconCake size={46} /> : <IconOnigiri size={46} />}
            </span>
          )}
          {floaters.map((f) => (
            <span
              key={`f${f.id}`}
              className={`floater is-${f.kind}`}
              style={{ left: f.x, "--dx": `${f.dx}px`, animationDelay: `${f.delay}ms` } as React.CSSProperties}
            >
              {f.kind === "heart" ? <IconHeart size={26} filled /> : <IconSparkle size={24} />}
            </span>
          ))}
        </button>
        {pet.reps === 0 && !isEgg && (
          <p className="tap-hint">
            <IconHand size={16} /> タップで なでる
          </p>
        )}
        </>
        )}
      </div>

      <div className="growth">
        {!isEgg && !pet.away && (
          <div className="meters">
            <Hearts label="おなか" value={pet.hunger} />
            <Hearts label="きげん" value={pet.mood} />
          </div>
        )}
        <div className="growth-row">
          <span className="growth-label">
            {isEgg ? "もうすぐ うまれる" : pet.away ? "おでかけ中。むかえに いこう" : needMeal ? "ごはん代まで" : paywall ? `つぎは ${next?.label ?? ""}` : next ? `つぎは ${next.label}` : "おとなに なった。ずっと いっしょ"}
          </span>
          <span className="growth-left">
            {isEgg ? "" : pet.away ? `あと ${COMEBACK_REPS - pet.away.reps}かい` : needMeal ? `あと ${Math.ceil((mealPrice - coins) / REP_COINS)}かい` : paywall ? "" : next ? `あと ${next.at - grown}かい` : ""}
          </span>
        </div>
        <div className="growth-bar" role="progressbar" aria-valuenow={Math.round(barValue * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: barValue > 0 ? `${Math.max(3, barValue * 100)}%` : "0%" }} />
        </div>
        {paywall && !pet.away ? (
          <button type="button" className="pill mini" onClick={showPaywall}>つづきを そだてる</button>
        ) : (
          <p className="growth-today">きょう {today}かい</p>
        )}
      </div>
    </div>
  );
}
