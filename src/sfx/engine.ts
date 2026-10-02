/**
 * AudioContext と マスタチェーン（Gain → destination）の
 * 共有 シングルトン。SFX も BGM も これを 通して 出力する。
 *
 * Android の画面録画は OS のミックスバッファから音を直接拾うため、
 * DynamicsCompressorNode を常時挿入しているとノイズフロアが乗る現象が
 * 報告されている。クリップ防止は各ソース側のゲインで担保し、
 * マスタは素通しの Gain だけにする。
 */

let ctx: AudioContext | null = null;
let masterOut: AudioNode | null = null;

// BGM が鳴っているべき間だけ true を返すガード。bgm.ts が登録する。
// iOS はカメラ起動(getUserMedia)や電話着信・Siri・画面ロック・他アプリの音など、
// あらゆるオーディオ割り込みで AudioContext を勝手に suspended/interrupted に
// 落とす。鳴っているべき間に落とされたら即 resume で復帰させる。
let autoResumeGuard: (() => boolean) | null = null;
// 割り込みから running に復帰したとき呼ぶ。iOS では割り込み中に
// AudioBufferSourceNode が破棄されることがあり、resume だけでは無音のまま。
// bgm.ts 側で source を鳴らし直すために使う。
let onInterruptEnd: (() => void) | null = null;
// BGM 再生中に外的要因でコンテキストが止められたかどうか。
let sawExternalPause = false;

export function setAutoResumeGuard(fn: () => boolean): void {
  autoResumeGuard = fn;
}

export function setInterruptEndHandler(fn: () => void): void {
  onInterruptEnd = fn;
}

// iOS 独自の "interrupted" は型定義に無いので文字列比較で判定する。
function isPausedState(c: AudioContext): boolean {
  const st = c.state as string;
  return st === "suspended" || st === "interrupted";
}

function installStateWatch(c: AudioContext): void {
  c.addEventListener("statechange", () => {
    const running = c.state === "running";
    if (!running && autoResumeGuard?.()) {
      // BGM が鳴っているべきなのに外的要因で止められた。
      // （BGM 再生中に我々が自発的に suspend することは無いので、外的要因確定）
      sawExternalPause = true;
      c.resume().catch(() => { /* 割り込み継続中は復帰できないことがある */ });
    } else if (running && sawExternalPause) {
      sawExternalPause = false;
      onInterruptEnd?.();
    }
  });
}

export function getEngineCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
      installStateWatch(ctx);
    } catch (e) {
      console.warn("[engine] AudioContext init failed", e);
      return null;
    }
  }
  if (isPausedState(ctx)) {
    ctx.resume().catch((e) => console.warn("[engine] resume failed", e));
  }
  return ctx;
}

/** 割り込みなどで止まったコンテキストを強制的に再開する（source は触らない）。 */
export function resumeEngine(): void {
  if (!ctx) return;
  if (isPausedState(ctx)) {
    ctx.resume().catch((e) => console.warn("[engine] resume failed", e));
  }
}

/** SFX/BGM 共通の マスタ出力ノード。Gain → destination の素通し。 */
export function getEngineMaster(c: AudioContext): AudioNode {
  if (masterOut) return masterOut;
  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);
  masterOut = master;
  return master;
}

/** AudioContext を 確実に suspend する（次の play 呼び出しで getEngineCtx が resume する） */
export function suspendEngine(): void {
  if (!ctx) return;
  if (ctx.state !== "running") return;
  ctx.suspend().catch(() => { /* ignore */ });
}

export function isEngineRunning(): boolean {
  return ctx?.state === "running";
}
