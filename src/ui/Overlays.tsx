import { useMemo, useState } from "react";
import { useGame, type Overlay } from "../game/store";
import { playCheerSfx, playEatingSfx } from "../sfx/sfx";
import { useEffect } from "react";
import { WEDDING_GIFT, REP_COINS } from "../game/economy";
import { asset } from "../asset";
import { STEPS_PER_UNIT } from "../game/rules";
import { PetFigure } from "./PetFigure";
import { buyUnlock, isNative, productPrice, requestSteps, restoreUnlock } from "../native/bridge";

const CONFETTI_COLORS = ["#FFCD57", "#F06A8E", "#A8DFC2", "#8EC9F0", "#FFFFFF"];

export function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.6 + Math.random() * 1.2,
        rot: Math.random() * 360,
        drift: (Math.random() - 0.5) * 120,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b) => (
        <span
          key={b.i}
          style={
            {
              left: `${b.left}%`,
              background: b.color,
              borderRadius: b.round ? "50%" : "2px",
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
              "--rot": `${b.rot}deg`,
              "--drift": `${b.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function GrewCard({ o, onClose }: { o: Extract<Overlay, { kind: "grew" }>; onClose: () => void }) {
  const hatched = o.stage.id === "hiyoko";
  const adult = o.stage.id === "adult";
  useEffect(() => playCheerSfx(), []);
  return (
    <div className="card card-grew">
      <div className="rays" aria-hidden="true" />
      <img className="card-img pop" src={asset(adult ? "piyo_ending.webp" : o.stage.img)} alt="" />
      <p className="card-kicker">{hatched ? "たまごが" : adult ? "そつぎょう" : "おおきくなった"}</p>
      <h2 className="card-title">{hatched ? "かえった！" : `${o.stage.label}に なった！`}</h2>
      {adult && <p className="card-text">おでかけの「であいの おうち」に いけるように なったよ。ひとりだちは じぶんで きめられる。ずっと いっしょでも いいよ</p>}
      <button type="button" className="pill" onClick={onClose}>
        やったね
      </button>
    </div>
  );
}

function NameCard({ onClose }: { onClose: () => void }) {
  const setName = useGame((s) => s.setName);
  const [v, setV] = useState("");
  const done = () => {
    setName(v.trim().slice(0, 8) || "ぴよこ");
    onClose();
  };
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        done();
      }}
    >
      <img className="card-img small" src={asset("piyo.webp")} alt="" />
      <h2 className="card-title">なまえを つけてね</h2>
      <input
        className="name-input"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="ぴよこ"
        maxLength={8}
        autoFocus
        enterKeyHint="done"
      />
      <button type="submit" className="pill">
        これにする
      </button>
    </form>
  );
}

function EndingCard({ o, onClose }: { o: Extract<Overlay, { kind: "ending" }>; onClose: () => void }) {
  const leave = o.ending === "leave";
  const marry = o.ending === "marry";
  const e = o.entry;
  useEffect(() => {
    if (marry) playCheerSfx();
  }, [marry]);
  if (marry)
    return (
      <div className="card card-marry">
        <div className="rays" aria-hidden="true" />
        <div className="couple">
          <img className="pop" src={asset("piyo_graduated.webp")} alt="" />
          <img className="pop" src={asset("piyo_partner.webp")} alt="" />
        </div>
        <p className="card-kicker">
          {e.gen}だいめ {e.name} と {e.spouse}
        </p>
        <h2 className="card-title">けっこん しました！</h2>
        <p className="card-text">
          ふたりの こどもの たまごを あずかったよ。
          <br />
          おいわいに コイン +{WEDDING_GIFT}
        </p>
        <button type="button" className="pill" onClick={onClose}>
          たまごを むかえる
        </button>
      </div>
    );
  return (
    <div className={`card ${leave ? "card-leave" : "card-runaway"}`}>
      {leave ? (
        <img className="card-img walk-away" src={asset("piyo_graduated.webp")} alt="" />
      ) : (
        <div className="letter" aria-hidden="true">
          <span>さがさないでね</span>
        </div>
      )}
      <p className="card-kicker">{e.gen}だいめ {e.name}</p>
      <h2 className="card-title">{leave ? "ひとりだち しました" : "いえで しちゃった"}</h2>
      <p className="card-text">
        {leave
          ? `${e.days}にちかん、${e.reps}かい いっしょに うごいたね。`
          : "おなか か きげんが からっぽに なっちゃった。"}
      </p>
      <button type="button" className="pill" onClick={onClose}>
        つぎの たまごを むかえる
      </button>
    </div>
  );
}

function AskStepsCard({ onClose }: { onClose: () => void }) {
  const answer = useGame((s) => s.answerSteps);
  const go = async (yes: boolean) => {
    if (yes) await requestSteps();
    answer(yes);
    onClose();
  };
  return (
    <div className="card">
      <PetFigure className="card-figure" />
      <h2 className="card-title">あるくと ごはん代が とどく</h2>
      <p className="card-text">しごと中に あるいた ぶんも、アプリを とじていて OK。つぎに ひらいた ときに うけとれるよ</p>
      <button type="button" className="pill" onClick={() => void go(true)}>歩数を つかう</button>
      <button type="button" className="text-btn" onClick={() => void go(false)}>あとで</button>
    </div>
  );
}

function DeliveryCard({ units, onClose }: { units: number; onClose: () => void }) {
  useEffect(() => playCheerSfx(), []);
  return (
    <div className="card card-delivery">
      <PetFigure className="card-figure" />
      <p className="card-kicker">{(units * STEPS_PER_UNIT).toLocaleString("ja-JP")}ほ ぶん</p>
      <h2 className="card-title">ごはん代が とどいた！</h2>
      <p className="card-text">コイン +{units * REP_COINS}</p>
      <button type="button" className="pill" onClick={onClose}>うけとる</button>
    </div>
  );
}

function BackCard({ onClose }: { onClose: () => void }) {
  useEffect(() => playCheerSfx(), []);
  return (
    <div className="card card-grew">
      <div className="rays" aria-hidden="true" />
      <PetFigure className="card-figure pop" />
      <h2 className="card-title">かえってきた！</h2>
      <p className="card-text">むかえに きてくれて ありがとう</p>
      <button type="button" className="pill" onClick={onClose}>おかえり</button>
    </div>
  );
}

function PaywallCard({ onClose }: { onClose: () => void }) {
  const unlock = useGame((s) => s.unlock);
  const name = useGame((s) => s.pet.name) || "この子";
  const [price, setPrice] = useState("1,500円");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void productPrice().then((p) => p && setPrice(p));
  }, []);
  const run = async (fn: () => Promise<"ok" | "cancel" | "none" | "error">, fail: string) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    if (r === "ok") unlock();
    else if (r !== "cancel") setMsg(r === "none" ? "買った きろくが みつからないよ" : fail);
  };
  return (
    <div className="card card-paywall">
      <img className="card-img silhouette" src={asset("piyo_student.webp")} alt="" />
      <p className="card-kicker">{name}の つづき</p>
      <h2 className="card-title">この先も そだてる？</h2>
      <p className="card-text">おとなに なるまで。けっこんも、つぎの たまごも</p>
      <button type="button" className="pill" disabled={busy} onClick={() => void run(buyUnlock, "買えなかったよ。あとで もういちど")}>
        {price}で つづきを みる
      </button>
      {!isNative() && <p className="card-text small">試作なので おかねは かかりません</p>}
      <p className="card-text small">{msg ?? "買わなくても いなくならないよ。ずっと いっしょ"}</p>
      <div className="card-links">
        <button type="button" className="text-btn" disabled={busy} onClick={onClose}>いまは いい</button>
        <button type="button" className="text-btn" disabled={busy} onClick={() => void run(restoreUnlock, "ふくげん できなかったよ")}>買った人は こちら</button>
      </div>
    </div>
  );
}

export function MealOffer() {
  const accept = useGame((s) => s.acceptMeal);
  const decline = useGame((s) => s.declineMeal);
  const name = useGame((s) => s.pet.name) || "この子";
  return (
    <div className="screen-overlay" role="dialog" aria-modal="true">
      <div className="card card-meal">
        <PetFigure className="card-figure" />
        <p className="card-kicker">おにぎりが 買えるよ</p>
        <h2 className="card-title">{name}に あげる？</h2>
        <button type="button" className="pill" onClick={() => { accept(); playEatingSfx(); }}>あげる</button>
        <button type="button" className="text-btn" onClick={decline}>あとで</button>
      </div>
    </div>
  );
}

export function OverlayLayer() {
  const overlays = useGame((s) => s.overlays);
  const close = useGame((s) => s.closeOverlay);
  const o = overlays[0];
  if (!o) return null;
  return (
    <div className="screen-overlay" role="dialog" aria-modal="true">
      {o.kind === "grew" && <GrewCard key={overlays.length} o={o} onClose={close} />}
      {o.kind === "name" && <NameCard onClose={close} />}
      {o.kind === "ending" && <EndingCard o={o} onClose={close} />}
      {o.kind === "askSteps" && <AskStepsCard onClose={close} />}
      {o.kind === "delivery" && <DeliveryCard key={overlays.length} units={o.units} onClose={close} />}
      {o.kind === "back" && <BackCard onClose={close} />}
      {o.kind === "paywall" && <PaywallCard onClose={close} />}
    </div>
  );
}

export function HelpCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="screen-overlay" role="dialog" aria-modal="true">
      <div className="card card-help">
        <h2 className="card-title">あそびかた</h2>
        <dl className="help">
          <dt>うんどう</dt>
          <dd>カメラの まえで スクワット。5かいで おにぎり 1こ</dd>
          <dt>あるく</dt>
          <dd>1000ほで 1かいぶん。ひらいた ときに とどく</dd>
          <dt>ほうって おいても</dt>
          <dd>いなくならないよ。まどの そとを みて まってる</dd>
        </dl>
        <button type="button" className="pill" onClick={onClose}>
          はじめる
        </button>
      </div>
    </div>
  );
}
