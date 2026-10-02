import { useMemo, useState } from "react";
import { useGame, type Overlay } from "../game/store";
import { STAGES } from "../game/rules";
import { playCheerSfx } from "../sfx/sfx";
import { useEffect } from "react";
import { WEDDING_GIFT, REP_COINS } from "../game/economy";

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
      <img className="card-img pop" src={adult ? "/piyo_ending.webp" : o.stage.img} alt="" />
      <p className="card-kicker">{hatched ? "たまごが" : adult ? "そつぎょう" : "おおきくなった"}</p>
      <h2 className="card-title">{hatched ? "かえった！" : `${o.stage.label}に なった！`}</h2>
      {adult && <p className="card-text">おでかけの「であいの おうち」に いけるように なったよ。3にち たつと ひとりだち するみたい</p>}
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
      <img className="card-img small" src="/piyo.webp" alt="" />
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
          <img className="pop" src="/piyo_graduated.webp" alt="" />
          <img className="pop" src="/piyo_partner.webp" alt="" />
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
        <img className="card-img walk-away" src="/piyo_graduated.webp" alt="" />
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
          <dd>カメラの まえで スクワット か うでたて。そだって 1かい {REP_COINS}コイン</dd>
          <dt>ごはん</dt>
          <dd>コインで かって たべさせる</dd>
          <dt>そうじ</dt>
          <dd>うんちを かたづける</dd>
          <dt>おでかけ</dt>
          <dd>1にち 3かい。おとなに なったら であいも</dd>
        </dl>
        <p className="card-text small">
          ぴよこを タップすると なでられる。おなか か きげんが 0に なると いえで しちゃう。{STAGES[STAGES.length - 1].at}かいで おとなに なるよ
        </p>
        <button type="button" className="pill" onClick={onClose}>
          はじめる
        </button>
      </div>
    </div>
  );
}
