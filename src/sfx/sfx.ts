import { isSfxMuted, isBgmActive, bgmShouldPlay } from "./bgm";
import { getEngineCtx, getEngineMaster, suspendEngine } from "./engine";
import { asset } from "../asset";

let unlocked = false;
let idleSuspendTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_SUSPEND_MS = 1500;

const getCtx = getEngineCtx;
const getMaster = getEngineMaster;

/**
 * 共有 AudioContext を SFX 鳴り終わり後に suspend（Android 画面録画ノイズ対策）。
 * BGM を鳴らすべき間は絶対に suspend しない。source の有無ではなく
 * bgmShouldPlay で判定するので、BGM のデコード待ちや iOS 割り込みで一時的に
 * source が無い瞬間でも suspend せず、BGM が数秒で無音化する不具合を防ぐ。
 */
function scheduleIdleSuspend(delayMs: number) {
  if (idleSuspendTimer) clearTimeout(idleSuspendTimer);
  idleSuspendTimer = setTimeout(() => {
    idleSuspendTimer = null;
    if (bgmShouldPlay() || isBgmActive()) return;
    suspendEngine();
  }, delayMs);
}

/** iOS/Safari/Android WebView では最初のユーザー操作で resume が必要。 */
export function unlockAudio() {
  if (unlocked) return;
  const c = getCtx();
  if (!c) return;
  unlocked = true;
  try {
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch (e) {
    console.warn("[sfx] unlock ping failed", e);
  }
  // unlock 直後 何も鳴らさない場合に備えて すぐ suspend を仕込む
  scheduleIdleSuspend(IDLE_SUSPEND_MS);
}

interface Tone {
  freq: number;
  start: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
}

function playTones(tones: Tone[], masterGain = 0.3) {
  if (isSfxMuted()) return;
  const c = getCtx();
  if (!c) return;
  const out = getMaster(c);
  const local = c.createGain();
  local.gain.value = masterGain;
  local.connect(out);
  const now = c.currentTime;
  let lastEndOffset = 0;
  for (const t of tones) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.value = t.freq;
    const vol = t.vol ?? 0.7;
    const s = now + t.start;
    const e = s + t.dur;
    gain.gain.setValueAtTime(0.0001, s);
    gain.gain.exponentialRampToValueAtTime(vol, s + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, e);
    osc.connect(gain).connect(local);
    osc.start(s);
    osc.stop(e + 0.02);
    if (t.start + t.dur > lastEndOffset) lastEndOffset = t.start + t.dur;
  }
  scheduleIdleSuspend(lastEndOffset * 1000 + IDLE_SUSPEND_MS);
}

export function playRepSfx() {
  playTones(
    [
      { freq: 880, start: 0, dur: 0.08, type: "triangle", vol: 0.95 },
      { freq: 1320, start: 0.06, dur: 0.12, type: "triangle", vol: 0.95 },
    ],
    0.55,
  );
}

export function playFeedSfx() {
  playTones([
    { freq: 660, start: 0, dur: 0.08, type: "sine" },
    { freq: 990, start: 0.08, dur: 0.12, type: "sine" },
  ]);
}

export function playDenySfx() {
  playTones([
    { freq: 220, start: 0, dur: 0.12, type: "square", vol: 0.4 },
    { freq: 180, start: 0.1, dur: 0.18, type: "square", vol: 0.4 },
  ]);
}

/**
 * 短いサンプルは WebAudio にデコードしてメモリ常駐。
 * HTMLAudioElement の pause()→play() レース問題を避け、
 * タップごとの再生を確実に。
 */
const bufferCache = new Map<string, AudioBuffer>();
const decodeFailed = new Set<string>();
const loading = new Set<string>();
function getBuffer(src: string): AudioBuffer | null {
  const b = bufferCache.get(src);
  if (b) return b;
  if (decodeFailed.has(src)) return null;
  const c = getCtx();
  if (!c) return null;
  if (loading.has(src)) return null;
  loading.add(src);
  fetch(src)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${src}`);
      return r.arrayBuffer();
    })
    .then((ab) => c.decodeAudioData(ab.slice(0)))
    .then((buf) => { bufferCache.set(src, buf); })
    .catch((e) => {
      decodeFailed.add(src);
      console.warn("[sfx] preload failed, fallback to HTMLAudio:", src, e);
    })
    .finally(() => { loading.delete(src); });
  return null;
}

/**
 * WebAudio が使えないケース（デコード失敗 / コンテキスト取得不能）用の
 * HTMLAudioElement プール。<audio> は pause→play レースに弱いので、
 * 要素を使い回さずクローンして毎回新しく再生する。
 */
const htmlAudioPool = new Map<string, HTMLAudioElement>();
function getHtmlAudio(src: string): HTMLAudioElement {
  let a = htmlAudioPool.get(src);
  if (!a) {
    a = new Audio(src);
    a.preload = "auto";
    htmlAudioPool.set(src, a);
  }
  return a;
}
function playHtmlFallback(src: string, volume: number): HTMLAudioElement | null {
  try {
    const base = getHtmlAudio(src);
    const node = base.cloneNode(true) as HTMLAudioElement;
    node.volume = Math.max(0, Math.min(1, volume));
    const p = node.play();
    if (p && typeof p.catch === "function") p.catch((e) => console.warn("[sfx] html play failed", src, e));
    return node;
  } catch (e) {
    console.warn("[sfx] html fallback error", src, e);
    return null;
  }
}

/** 事前にデコードして常駐させる（初期化時に呼ぶと 初回タップから確実に鳴る） */
export function preloadSfx(src: string) {
  getBuffer(src);
  // HTMLAudio 側も暖めておく（WebAudio が失敗した時のフォールバック用）
  getHtmlAudio(src);
}

function playSample(src: string, volume = 0.85, opts?: { maxMs?: number }) {
  if (isSfxMuted()) return;
  const c = getCtx();
  const buf = c ? getBuffer(src) : null;
  if (c && buf) {
    try {
      const source = c.createBufferSource();
      const gain = c.createGain();
      gain.gain.value = Math.max(0, Math.min(1, volume));
      source.buffer = buf;
      source.connect(gain).connect(getMaster(c));
      source.start(0);
      const playMs = opts?.maxMs && opts.maxMs > 0
        ? opts.maxMs
        : buf.duration * 1000;
      if (opts?.maxMs && opts.maxMs > 0) {
        source.stop(c.currentTime + opts.maxMs / 1000);
      }
      scheduleIdleSuspend(playMs + IDLE_SUSPEND_MS);
      return;
    } catch (e) {
      console.warn("[sfx] webaudio start failed, fallback", src, e);
    }
  }
  const node = playHtmlFallback(src, volume);
  if (node && opts?.maxMs && opts.maxMs > 0) {
    window.setTimeout(() => {
      try { node.pause(); } catch { /* ignore */ }
    }, opts.maxMs);
  }
}

const SFX_PET = asset("sfx/piyo-chirp.mp3");
const SFX_EATING = asset("sfx/eating.mp3");
const SFX_CLICK = asset("sfx/click.mp3");
const SFX_CLEAN = asset("sfx/clean.mp3");

export function preloadAllSfx() {
  [SFX_PET, SFX_EATING, SFX_CLICK, SFX_CLEAN].forEach(preloadSfx);
}

export function playPetSfx() {
  playSample(SFX_PET, 0.85);
}

export function playEatingSfx() {
  playSample(SFX_EATING, 0.9);
}

export function playClickSfx() {
  playSample(SFX_CLICK, 0.6);
}

export function playCleanSfx() {
  playSample(SFX_CLEAN, 0.85);
}

export function playCheerSfx() {
  playTones([
    { freq: 523, start: 0, dur: 0.12, type: "triangle" },
    { freq: 659, start: 0.12, dur: 0.12, type: "triangle" },
    { freq: 784, start: 0.24, dur: 0.18, type: "triangle" },
    { freq: 1047, start: 0.4, dur: 0.25, type: "triangle" },
  ]);
}
