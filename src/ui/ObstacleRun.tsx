import { useEffect, useRef, useState } from "react";
import { useGame } from "../game/store";
import { stageOf } from "../game/rules";
import { PLAY_COIN_PER_OBSTACLE, PLAY_MAX_COINS } from "../game/economy";
import { playCheerSfx, playDenySfx, playRepSfx } from "../sfx/sfx";
import { IconCoin } from "./icons";
import { asset } from "../asset";

// 元の ぴよふぃっと の しょうがいぶつ きょうそう。
// 物理は 1/60秒の 固定ステップで すすめる（120Hz の 端末で 2倍速に ならないように）
const W = 360;
const H = 180;
const GROUND_Y = H - 22;
const PIYO = 40;
const GRAVITY = 0.55;
const JUMP_V = -10;
const SPEED_START = 2.8;
const SPEED_MAX = 7;
const SPEED_RAMP_PER_STEP = 0.00035 * (1000 / 60);
const STEP_MS = 1000 / 60;

type Phase = "ready" | "playing" | "ended";

interface Obstacle {
  x: number;
  w: number;
  h: number;
  passed: boolean;
}

export function ObstacleRun({ onDone }: { onDone: () => void }) {
  const pet = useGame((s) => s.pet);
  const best = useGame((s) => s.playBest);
  const finishPlay = useGame((s) => s.finishPlay);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const bgRef = useRef<HTMLImageElement | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);

  const g = useRef({
    phase: "ready" as Phase,
    y: GROUND_Y - PIYO,
    vy: 0,
    obs: [] as Obstacle[],
    steps: 0,
    acc: 0,
    last: 0,
    score: 0,
    raf: 0,
  });

  const draw = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const s = g.current;
    ctx.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
    if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, W, H);
    else {
      ctx.fillStyle = "#fdf3e2";
      ctx.fillRect(0, 0, W, H);
    }
    for (const o of s.obs) {
      // くさ：葉っぱを 4まい たてる（あたり判定の 四角に おさまる 形）
      const blades = [
        { x: 0.12, h: 0.7, lean: -0.35 },
        { x: 0.38, h: 1.0, lean: -0.1 },
        { x: 0.62, h: 0.92, lean: 0.15 },
        { x: 0.88, h: 0.66, lean: 0.4 },
      ];
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#4f8f6a";
      ctx.lineWidth = 1.5;
      for (const [i, bl] of blades.entries()) {
        const bx = o.x + o.w * bl.x;
        const tipX = bx + o.w * bl.lean;
        const tipY = GROUND_Y - o.h * bl.h;
        const half = o.w * 0.2;
        ctx.fillStyle = i % 2 ? "#7cc59a" : "#93d3ac";
        ctx.beginPath();
        ctx.moveTo(bx - half, GROUND_Y);
        ctx.quadraticCurveTo(bx - half * 0.6, (GROUND_Y + tipY) / 2, tipX, tipY);
        ctx.quadraticCurveTo(bx + half * 0.6, (GROUND_Y + tipY) / 2, bx + half, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    if (imgRef.current) ctx.drawImage(imgRef.current, 44, s.y, PIYO, PIYO);
  };

  useEffect(() => {
    const img = new Image();
    img.src = asset(stageOf(pet).img);
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    const bg = new Image();
    bg.src = asset("play-bg.webp");
    bg.onload = () => {
      bgRef.current = bg;
      draw();
    };
    // 画面の 密度に あわせて キャンバスを くっきりさせる
    const c = canvasRef.current;
    if (c) {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      c.width = W * dpr;
      c.height = H * dpr;
    }
    draw();
    const s = g.current;
    return () => cancelAnimationFrame(s.raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = () => {
    const s = g.current;
    s.steps++;
    const speed = Math.min(SPEED_MAX, SPEED_START + s.steps * SPEED_RAMP_PER_STEP);
    s.vy += GRAVITY;
    s.y += s.vy;
    if (s.y > GROUND_Y - PIYO) {
      s.y = GROUND_Y - PIYO;
      s.vy = 0;
    }
    for (const o of s.obs) o.x -= speed;
    while (s.obs.length && s.obs[0].x + s.obs[0].w < -10) s.obs.shift();
    const last = s.obs[s.obs.length - 1];
    if (!last || last.x < W - (160 + Math.random() * 90)) {
      const gap = 140 + Math.random() * 180 + speed * 10;
      s.obs.push({ x: (last ? last.x : W + 60) + gap, w: 18 + Math.floor(Math.random() * 8), h: 22 + Math.floor(Math.random() * 22), passed: false });
    }
    // あたり判定は 見た目より すこし 小さめ
    const l = 44 + 6;
    const r = 44 + PIYO - 6;
    const t = s.y + 5;
    const b = s.y + PIYO - 3;
    for (const o of s.obs) {
      if (!o.passed && o.x + o.w < l) {
        o.passed = true;
        if (s.score < PLAY_MAX_COINS) {
          s.score = Math.min(PLAY_MAX_COINS, s.score + PLAY_COIN_PER_OBSTACLE);
          setScore(s.score);
        }
      }
      if (r > o.x && l < o.x + o.w && b > GROUND_Y - o.h && t < GROUND_Y) return false;
    }
    return true;
  };

  const end = () => {
    const s = g.current;
    s.phase = "ended";
    setPhase("ended");
    cancelAnimationFrame(s.raf);
    finishPlay(s.score);
    if (s.score > 0) playCheerSfx();
    else playDenySfx();
  };

  const loop = (now: number) => {
    const s = g.current;
    if (s.phase !== "playing") return;
    // タブ切りかえ等で 時間が とんでも 一気に すすめすぎない
    s.acc += Math.min(250, now - s.last);
    s.last = now;
    while (s.acc >= STEP_MS) {
      s.acc -= STEP_MS;
      if (!update()) {
        draw();
        end();
        return;
      }
    }
    draw();
    s.raf = requestAnimationFrame(loop);
  };

  const start = () => {
    const s = g.current;
    s.phase = "playing";
    s.y = GROUND_Y - PIYO;
    s.vy = JUMP_V;
    s.obs = [{ x: W + 220, w: 20, h: 28, passed: false }];
    s.steps = 0;
    s.acc = 0;
    s.score = 0;
    s.last = performance.now();
    setScore(0);
    setPhase("playing");
    playRepSfx();
    s.raf = requestAnimationFrame(loop);
  };

  const press = () => {
    const s = g.current;
    if (s.phase === "ready") return start();
    if (s.phase === "playing" && s.y >= GROUND_Y - PIYO - 0.5) {
      s.vy = JUMP_V;
      playRepSfx();
    }
  };

  return (
    <div className="run">
      <div
        className="run-stage"
        onPointerDown={(e) => {
          e.preventDefault();
          press();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="run-canvas" />
        <span className="run-score">
          <IconCoin size={14} /> {score}
        </span>
        {phase === "ready" && (
          <div className="run-cover">
            <p className="run-title">タップで スタート</p>
            <p className="run-note">タップで ジャンプ。くさを こえるたびに +{PLAY_COIN_PER_OBSTACLE}コイン（さいだい {PLAY_MAX_COINS}）</p>
          </div>
        )}
        {phase === "ended" && (
          <div className="run-cover is-end">
            <p className="run-title">{score > 0 ? `+${score} コイン ゲット！` : "ざんねん…"}</p>
            <p className="run-note">ベスト {Math.max(best, score)}</p>
          </div>
        )}
      </div>
      <p className="run-help">{phase === "ended" ? "1かい あそんだら おうちに かえるよ" : "くさに ぶつかったら おしまい"}</p>
      {phase === "ended" && (
        <button type="button" className="pill" onClick={onDone}>
          かえる
        </button>
      )}
    </div>
  );
}
