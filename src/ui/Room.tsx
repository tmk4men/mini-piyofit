import { useEffect, useRef, useState } from "react";
import { useGame, todayReps } from "../game/store";
import { HATCH_AFTER_MS, hearts, nextStageOf, stageFor, stageOf } from "../game/rules";
import { idleLine } from "../game/lines";
import { IconHand, IconHeart } from "./icons";
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

const POOP_SPOTS = [
  { left: "14%", bottom: "16%" },
  { left: "74%", bottom: "12%" },
  { left: "22%", bottom: "4%" },
];

export function Room({ onPat }: { onPat: () => void }) {
  const pet = useGame((s) => s.pet);
  const speech = useGame((s) => s.speech);
  const today = useGame(todayReps);
  const stage = stageOf(pet);
  const next = nextStageOf(pet);
  const [floaters, setFloaters] = useState<{ id: number; x: number }[]>([]);
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
  const line = fresh ? speech!.text : idle;

  const isEgg = stage.id === "egg";
  const weak = !isEgg && (pet.hunger < 10 || pet.mood < 10);
  const prevFloor = next ? stageFor(pet.reps).at : 0;
  // たまごの あいだは かえるまでの 時間で バーを すすめる
  const progress = isEgg
    ? Math.min(1, Math.max(0, (pet.lastTick - pet.bornAt) / HATCH_AFTER_MS))
    : next
      ? (pet.reps - prevFloor) / (next.at - prevFloor)
      : 1;

  const tap = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const id = ++idRef.current;
    setFloaters((f) => [...f, { id, x: e.clientX - r.left }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 900);
    setBump((b) => b + 1);
    onPat();
  };

  return (
    <div className="room">
      <div className="stage-area">
        <p className="bubble" key={line}>
          {line}
        </p>

        {POOP_SPOTS.slice(0, pet.poops).map((p, i) => (
          <img key={`poop${i}`} className="poop" src={asset("piyo_poop.webp")} alt="うんち" style={p} />
        ))}

        <button
          type="button"
          className={`pet${weak ? " is-weak" : ""}${isEgg ? " is-egg" : ""}`}
          onPointerDown={tap}
          aria-label={isEgg ? "たまごを なでる" : "なでる"}
        >
          <PetFigure key={`img${bump}`} className="pet-img" />
          {floaters.map((f) => (
            <span key={`f${f.id}`} className="floater" style={{ left: f.x }}>
              <IconHeart size={22} filled />
            </span>
          ))}
        </button>
        {pet.reps === 0 && !isEgg && (
          <p className="tap-hint">
            <IconHand size={16} /> タップで なでる
          </p>
        )}
      </div>

      <div className="growth">
        {!isEgg && (
          <div className="meters">
            <Hearts label="おなか" value={pet.hunger} />
            <Hearts label="きげん" value={pet.mood} />
          </div>
        )}
        <div className="growth-row">
          <span className="growth-label">{isEgg ? "もうすぐ うまれる" : next ? `つぎは ${next.label}` : "ひとりだち まで もうすこし"}</span>
          <span className="growth-left">{isEgg ? "" : next ? `うんどう あと ${next.at - pet.reps}かい` : ""}</span>
        </div>
        <div className="growth-bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: progress > 0 ? `${Math.max(3, progress * 100)}%` : "0%" }} />
        </div>
        <p className="growth-today">きょう {today}かい</p>
      </div>
    </div>
  );
}
