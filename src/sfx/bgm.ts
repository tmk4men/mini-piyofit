/**
 * BGM 再生（WebAudio AudioBufferSourceNode 方式）。
 * デコード済み PCM を loop=true で つなげて 鳴らすので、
 * mp3 の エンコーダパディングによる 隙間が 出ない（ギャップレスループ）。
 */
import { getEngineCtx, getEngineMaster, isEngineRunning, resumeEngine, setAutoResumeGuard, setInterruptEndHandler } from "./engine";
import { asset } from "../asset";

const SRC = asset("bgm/new-bgm.mp3");
const STORAGE_KEY_BGM = "mini-piyofit-bgm-muted";
const STORAGE_KEY_SFX = "mini-piyofit-sfx-muted";
const BGM_GAIN = 0.25;

let buffer: AudioBuffer | null = null;
let buffering: Promise<AudioBuffer | null> | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let highpass: BiquadFilterNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let hasStarted = false;
let startedAt = 0;
let pausedOffset = 0;

/**
 * BGM を鳴らすべき状態か（開始済み かつ ミュートでない）。
 * source の有無は問わない＝デコード待ちや割り込みで一時的に source が
 * 無い瞬間も「鳴らすべき」と判定する。SFX 用のアイドル suspend が
 * この間に走って無音化するのを防ぐために使う。
 */
export function bgmShouldPlay(): boolean {
  return hasStarted && !isBgmMuted();
}

// iOS の割り込みでコンテキストが落とされたとき、BGM が実際に鳴っている
// （source が生きている）のに止められたなら自動 resume して無音化を防ぐ。
// 背景化などで意図的に pause した場合は source が null になるので false。
setAutoResumeGuard(() => bgmShouldPlay() && source != null);

// 割り込み（電話・Siri・画面ロック・他アプリの音など）から復帰したとき、
// iOS では再生中だった source が破棄されていることがある。resume だけでは
// 無音のままなので、鳴らし直す。
setInterruptEndHandler(() => {
  if (!bgmShouldPlay()) return;
  void playFrom(currentOffset());
});

async function loadBuffer(): Promise<AudioBuffer | null> {
  if (buffer) return buffer;
  if (buffering) return buffering;
  const ctx = getEngineCtx();
  if (!ctx) return null;
  buffering = (async () => {
    try {
      const res = await fetch(SRC);
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      buffer = buf;
      return buf;
    } catch (e) {
      console.warn("[bgm] load failed", e);
      return null;
    } finally {
      buffering = null;
    }
  })();
  return buffering;
}

function ensureGain(): AudioNode | null {
  const ctx = getEngineCtx();
  if (!ctx) return null;
  if (!gain) {
    gain = ctx.createGain();
    gain.gain.value = BGM_GAIN;
  }
  if (!highpass) {
    // mp3 に乗ってる低域ハム/DCオフセットを除去。スマホスピーカーでは聞こえないが
    // Android 画面録画は OS のミックスをデジタル吸い上げするので、低域成分が
    // ノイズとして乗る現象がある。80Hz 以下を落として防ぐ。
    highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 120;
    highpass.Q.value = 0.707;
    gain.connect(highpass);
  }
  if (!compressor) {
    // ベースの瞬発音で音量が跳ねると Android 画面録画の AGC が反応して
    // ノイズフロアを揺らす。軽めのコンプで BGM の音量変動を均して
    // AGC を刺激しないようにする。音作り目的の強い圧縮ではない。
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, ctx.currentTime);
    compressor.knee.setValueAtTime(12, ctx.currentTime);
    compressor.ratio.setValueAtTime(2.5, ctx.currentTime);
    compressor.attack.setValueAtTime(0.01, ctx.currentTime);
    compressor.release.setValueAtTime(0.2, ctx.currentTime);
    highpass.connect(compressor);
    compressor.connect(getEngineMaster(ctx));
  }
  return gain;
}

/**
 * 即時停止だと波形が非ゼロ点で切れて「プチッ」と鳴る。
 * gain を 30ms で 0 に落としてから停止することで クリック音を回避。
 */
const FADE_OUT_SEC = 0.03;

function stopSource() {
  if (!source) return;
  const ctx = getEngineCtx();
  const src = source;
  source = null;
  if (ctx && gain) {
    const now = ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
    } catch { /* ignore */ }
    try { src.stop(now + FADE_OUT_SEC); } catch { /* ignore */ }
    setTimeout(() => {
      try { src.disconnect(); } catch { /* ignore */ }
    }, Math.ceil(FADE_OUT_SEC * 1000) + 20);
  } else {
    try { src.stop(); } catch { /* ignore */ }
    try { src.disconnect(); } catch { /* ignore */ }
  }
}

function startSource(offset: number) {
  const ctx = getEngineCtx();
  if (!ctx || !buffer) return;
  const g = ensureGain();
  if (!g || !gain) return;
  // 前回の停止時にフェードで 0 まで落としているので、毎回 BGM_GAIN に戻す。
  // 立ち上がりも 10ms フェードインしてプチッを防止。
  const now = ctx.currentTime;
  try {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(BGM_GAIN, now + 0.01);
  } catch { /* ignore */ }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  // loop=true でも iOS の割り込みなどで source が勝手に終わることがある。
  // 終わったら source を空にして「鳴っている」と誤判定しないようにする。
  src.onended = () => { if (source === src) source = null; };
  src.connect(g);
  const dur = buffer.duration;
  const safeOffset = dur > 0 ? ((offset % dur) + dur) % dur : 0;
  src.start(0, safeOffset);
  startedAt = ctx.currentTime - safeOffset;
  source = src;
}

function currentOffset(): number {
  const ctx = getEngineCtx();
  if (!ctx || !buffer) return pausedOffset;
  const elapsed = ctx.currentTime - startedAt;
  const dur = buffer.duration;
  return dur > 0 ? ((elapsed % dur) + dur) % dur : 0;
}

async function playFrom(offset: number) {
  const buf = await loadBuffer();
  if (!buf) return;
  if (isBgmMuted()) return;
  stopSource();
  startSource(offset);
}

/** SFX 側の suspend 判定で 使う。BGM が 鳴ってる間は AudioContext を 落とさない。 */
export function isBgmActive(): boolean {
  return source != null && !isBgmMuted();
}

export function isBgmMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_BGM) === "1";
  } catch {
    return false;
  }
}

export function isSfxMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SFX) === "1";
  } catch {
    return false;
  }
}

export function setBgmMuted(muted: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY_BGM, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (muted) {
    if (source) {
      pausedOffset = currentOffset();
      stopSource();
    }
  } else if (hasStarted) {
    void playFrom(pausedOffset);
  }
}

export function setSfxMuted(muted: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY_SFX, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** 初回ユーザー操作で呼ぶ。以降 visibility 復帰でも再開できるようになる。 */
export async function startBgm() {
  hasStarted = true;
  if (isBgmMuted()) {
    void loadBuffer();
    return;
  }
  await playFrom(pausedOffset);
}

/** タブ非表示時など、一時停止 */
export function pauseBgm() {
  if (!source) return;
  pausedOffset = currentOffset();
  stopSource();
}

/**
 * 止まっていたら鳴らし直す共通処理。
 * force=true は「source が生きていても必ず作り直す」。iOS では広告 SDK や
 * 電話などにオーディオセッションを奪われると、AudioContext は running のまま
 * source だけが実質死ぬことがあり、source の有無では無音を検知できない。
 */
function recoverBgm(force: boolean) {
  if (!hasStarted) return;
  if (isBgmMuted()) return;
  // resume する前に見ないと「元から止まっていたのか」が分からなくなる
  const wasRunning = isEngineRunning();
  const offset = source ? currentOffset() : pausedOffset;
  resumeEngine();
  if (force || !wasRunning || !source) void playFrom(offset);
}

/** 可視性復帰時などに再開。未startやmute中は何もしない。 */
export function resumeBgm() {
  recoverBgm(false);
}

/**
 * カメラ起動(getUserMedia)などでオーディオセッションが奪われた前後に呼ぶ。
 * iOS では getUserMedia の前後で AudioContext が suspended/interrupted に
 * 落ちるため、明示的にエンジンを起こして BGM を確実に鳴らし直す。
 */
export function kickBgm() {
  // タップの度に呼ばれるので force はしない（毎回鳴らし直すと音が途切れる）
  recoverBgm(false);
}

/**
 * リワード広告の再生後など、外部にオーディオを完全に奪われた直後に呼ぶ。
 * source を必ず作り直すので、無音になっていても確実に鳴り直す。
 */
export function restartBgm() {
  recoverBgm(true);
}

export function toggleBgm(): boolean {
  const next = !isBgmMuted();
  setBgmMuted(next);
  if (!next) void startBgm();
  return next;
}

export function toggleSfx(): boolean {
  const next = !isSfxMuted();
  setSfxMuted(next);
  return next;
}
