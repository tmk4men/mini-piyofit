import { useGame } from "../game/store";
import { stageOf } from "../game/rules";
import { outfitFit } from "../game/economy";

/** いまの段階の ぴよこ ＋ 着ている おしゃれ */
export function PetFigure({ className = "", imgKey }: { className?: string; imgKey?: string | number }) {
  const pet = useGame((s) => s.pet);
  const wearing = useGame((s) => s.wearing);
  const stage = stageOf(pet);
  const fit = wearing && stage.id !== "egg" ? outfitFit(wearing, stage.id) : null;
  return (
    <span className={`figure ${className}`}>
      <img key={imgKey} className="figure-body" src={stage.img} alt={stage.label} draggable={false} />
      {fit && (
        <img
          className="figure-outfit"
          src={`/outfit_${wearing}.webp`}
          alt=""
          draggable={false}
          style={{ width: `${fit.width * 100}%`, top: `${fit.top * 100}%` }}
        />
      )}
    </span>
  );
}
