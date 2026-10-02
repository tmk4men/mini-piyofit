import { useState } from "react";
import { outingsLeft, useGame } from "../game/store";
import { BOND_TO_PROPOSE, FOODS, OUTFITS, OUTINGS_PER_DAY, PLACES, placeOpen, type OutingResult, type Place } from "../game/economy";
import { isEgg as eggOf, stageOf } from "../game/rules";
import { FULL_LINES, pick } from "../game/lines";
import { playCheerSfx, playClickSfx, playDenySfx, playEatingSfx } from "../sfx/sfx";
import { IconBento, IconCake, IconClose, IconCoin, IconOnigiri, IconRing } from "./icons";
import { PetFigure } from "./PetFigure";
import { ObstacleRun } from "./ObstacleRun";
import { asset } from "../asset";

const FOOD_ICON: Record<string, (p: { size?: number }) => JSX.Element> = {
  onigiri: IconOnigiri,
  bento: IconBento,
  cake: IconCake,
};

const POOR = "コインが たりない。うんどうで ためよう";

/** 下に 出す ひとこと。コインが たりない ときは そのまま うんどうへ いける */
function PanelMsg({ msg }: { msg: string }) {
  const setMode = useGame((s) => s.setMode);
  return (
    <p className="panel-msg" key={msg}>
      {msg}
      {msg === POOR && (
        <button type="button" className="pill mini" onClick={() => setMode("exercise")}>
          うんどうする
        </button>
      )}
    </p>
  );
}

function PanelHead({ title, onClose }: { title: string; onClose: () => void }) {
  const coins = useGame((s) => s.coins);
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      <span className="coin-pill small">
        <IconCoin size={16} /> {coins}
      </span>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="もどる">
        <IconClose />
      </button>
    </div>
  );
}

function FoodList() {
  const g = useGame.getState;
  const coins = useGame((s) => s.coins);
  const [msg, setMsg] = useState<string | null>(null);
  const buy = (id: string, name: string) => {
    const r = g().buyFood(id);
    if (r === "ok") {
      playEatingSfx();
      setMsg(`${name}を たべた！`);
      g().say("もぐもぐ…おいしい！");
    } else if (r === "full") {
      playDenySfx();
      setMsg(pick(FULL_LINES));
    } else {
      playDenySfx();
      setMsg(POOR);
    }
  };
  return (
    <>
      <ul className="goods">
        {FOODS.map((f) => {
          const Icon = FOOD_ICON[f.id];
          return (
            <li key={f.id}>
              <button type="button" className="good" onClick={() => buy(f.id, f.name)} aria-disabled={coins < f.price}>
                <span className="good-icon">
                  <Icon size={30} />
                </span>
                <span className="good-name">{f.name}</span>
                <span className="good-effect">
                  {f.hunger > 0 && `おなか +${f.hunger}`}
                  {f.hunger > 0 && f.mood > 0 && " "}
                  {f.mood > 0 && `きげん +${f.mood}`}
                </span>
                <span className={`good-price${coins < f.price ? " is-short" : ""}`}>
                  <IconCoin size={14} /> {f.price}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <PanelMsg msg={msg ?? "タップで かって たべさせる"} />
    </>
  );
}

function OutfitList() {
  const g = useGame.getState;
  const coins = useGame((s) => s.coins);
  const owned = useGame((s) => s.owned);
  const wearing = useGame((s) => s.wearing);
  const [msg, setMsg] = useState<string | null>(null);
  const tap = (id: (typeof OUTFITS)[number]["id"], price: number) => {
    if (owned.includes(id)) {
      playClickSfx();
      g().wear(wearing === id ? null : id);
      setMsg(wearing === id ? "はずした" : "にあう！");
      return;
    }
    if (coins < price) {
      playDenySfx();
      setMsg(POOR);
      return;
    }
    g().buyOutfit(id);
    playCheerSfx();
    setMsg("かった！ さっそく つけてみた");
  };
  return (
    <>
      <ul className="goods outfits">
        {OUTFITS.map((o) => {
          const has = owned.includes(o.id);
          return (
            <li key={o.id}>
              <button type="button" className={`good${wearing === o.id ? " is-on" : ""}`} onClick={() => tap(o.id, o.price)}>
                <img className="good-img" src={asset(`outfit_${o.id}.webp`)} alt="" />
                <span className="good-name">{o.name}</span>
                {has ? (
                  <span className="good-state">{wearing === o.id ? "つけてる" : "もってる"}</span>
                ) : (
                  <span className={`good-price${coins < o.price ? " is-short" : ""}`}>
                    <IconCoin size={14} /> {o.price}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {msg && <PanelMsg msg={msg} />}
    </>
  );
}

export function ShopPanel({ foodOnly, onClose }: { foodOnly?: boolean; onClose: () => void }) {
  const isEgg = useGame((s) => eggOf(s.pet));
  return (
    <div className="panel">
      <PanelHead title={foodOnly ? "ごはん" : "おみせ"} onClose={onClose} />
      <div className="panel-body">
        {isEgg && foodOnly ? (
          <p className="panel-empty">まだ たまごだよ。うんどうして かえして あげよう</p>
        ) : (
          <>
            {!foodOnly && <h3 className="panel-sub">ごはん</h3>}
            {isEgg ? <p className="panel-hint left">ごはんは たまごが かえってから</p> : <FoodList />}
            {!foodOnly && (
              <>
                <h3 className="panel-sub">おしゃれ</h3>
                <OutfitList />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Scene({ place, result, onBack }: { place: Place; result: OutingResult; onBack: () => void }) {
  const pet = useGame((s) => s.pet);
  const propose = useGame((s) => s.propose);
  const canPropose = place.id === "date" && (pet.partner?.bond ?? 0) >= BOND_TO_PROPOSE;
  return (
    <div className="scene" style={{ backgroundImage: `url(${asset(place.bg)})` }}>
      <div className="scene-cast">
        <PetFigure className="scene-pet" />
        {place.host && <img className="scene-host" src={asset(place.host)} alt="" />}
      </div>
      <div className="scene-text">
        <p className="scene-place">{place.name}</p>
        {result.lines.map((l, i) => (
          <p key={i} className={i === 0 ? "scene-line" : "scene-effect"}>
            {l}
          </p>
        ))}
        <div className="scene-actions">
          {canPropose && (
            <button
              type="button"
              className="pill pink"
              onClick={() => {
                playCheerSfx();
                propose();
              }}
            >
              <IconRing size={20} /> プロポーズする
            </button>
          )}
          <button type="button" className="pill" onClick={onBack}>
            かえる
          </button>
        </div>
      </div>
    </div>
  );
}

export function OutingPanel({ onClose }: { onClose: () => void }) {
  const pet = useGame((s) => s.pet);
  const coins = useGame((s) => s.coins);
  const left = useGame(outingsLeft);
  const goOuting = useGame((s) => s.goOuting);
  const [scene, setScene] = useState<{ place: Place; result: OutingResult } | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const isEgg = eggOf(pet);

  if (running)
    return (
      <div className="panel">
        <PanelHead title="はらっぱ" onClose={() => setRunning(false)} />
        <div className="panel-body">
          <ObstacleRun onDone={onClose} />
        </div>
      </div>
    );
  if (scene) return <Scene place={scene.place} result={scene.result} onBack={() => setScene(null)} />;

  const go = (p: Place) => {
    const r = goOuting(p.id);
    if (r === "tired") {
      playDenySfx();
      setMsg("きょうは もう つかれちゃった。また あした");
    } else if (r === "poor") {
      playDenySfx();
      setMsg(POOR);
    } else if (r === "closed") {
      playDenySfx();
    } else if (p.id === "field") {
      playClickSfx();
      setRunning(true);
    } else {
      playClickSfx();
      setScene({ place: p, result: r });
    }
  };

  const visible = PLACES.filter((p) => p.id !== "date" || placeOpen(pet, p));

  return (
    <div className="panel">
      <PanelHead title="おでかけ" onClose={onClose} />
      <div className="panel-body">
        {isEgg ? (
          <p className="panel-empty">たまごの うちは おでかけ できないよ</p>
        ) : (
          <>
            <p className="panel-note">
              きょう あと <b>{left}</b> / {OUTINGS_PER_DAY}かい
            </p>
            <ul className="places">
              {visible.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`place${p.id === "date" ? " is-date" : ""}`}
                    onClick={() => go(p)}
                    aria-disabled={left <= 0 || coins < p.price}
                    style={{ backgroundImage: `url(${asset(p.bg)})` }}
                  >
                    <span className="place-text">
                      <span className="place-name">{p.name}</span>
                      <span className="place-note">
                        {p.id === "date" && pet.partner ? `${pet.partner.name}と なかよし ${pet.partner.bond} / ${BOND_TO_PROPOSE}` : p.note}
                      </span>
                    </span>
                    <span className="place-price">
                      {p.price > 0 ? (
                        <>
                          <IconCoin size={14} /> {p.price}
                        </>
                      ) : (
                        "むりょう"
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {stageOf(pet).id !== "adult" && <p className="panel-hint">おとなに なると「であいの おうち」に いけるよ</p>}
            {msg && <PanelMsg msg={msg} />}
          </>
        )}
      </div>
    </div>
  );
}
