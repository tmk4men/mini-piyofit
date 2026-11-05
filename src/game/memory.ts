// この子が あなたの生活を 覚えている。本当の記録からだけ 言う（AI は使わない）

export interface DayLog {
  reps: number;
  /** 受け取った 1000歩の 数 */
  units: number;
  /** その日 はじめて ひらいた 時（0〜23）。ひらいて いなければ なし */
  hour?: number;
}

export type History = Record<string, DayLog>;

const DAY = 86_400_000;

const key = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export const dayLog = (h: History, day: string): DayLog => h[day] ?? { reps: 0, units: 0 };

/** 古い記録は 捨てる */
export function pruneHistory(h: History, now: number, keepDays = 30): History {
  const keep = new Set(Array.from({ length: keepDays }, (_, i) => key(now - i * DAY)));
  return Object.fromEntries(Object.entries(h).filter(([d]) => keep.has(d)));
}

/**
 * その日 はじめて ひらいた ときの ひとこと。言えることが なければ null（作り話を しない）。
 * history には まだ 今日の hour が 入っていない 状態で 呼ぶ。
 */
export function memoryLine(history: History, now: number): string | null {
  const back = (i: number) => dayLog(history, key(now - i * DAY));

  // 前に ひらいた日から どれだけ あいたか
  let gap = 0;
  for (let i = 1; i <= 30; i++) {
    if (back(i).hour != null) {
      gap = i;
      break;
    }
  }
  if (gap >= 3) return `${gap}にちぶり。まってた`;

  const y = back(1);
  if (y.units >= 5) return `きのう ${(y.units * 1000).toLocaleString("ja-JP")}ほも あるいたね`;
  if (y.reps >= 10) return `きのう ${y.reps}かいも うごいたね`;

  // 3日 つづけて 動いた（途切れた日の ことは 言わない）
  let moved = 0;
  while (moved < 30 && (back(moved + 1).reps > 0 || back(moved + 1).units > 0)) moved++;
  if (moved >= 3) return `${moved}にち つづけて うごいてる`;

  // おなじ 時間に 来てくれる
  const hour = new Date(now).getHours();
  const near = (d: DayLog) => d.hour != null && Math.abs(d.hour - hour) <= 1;
  if (near(back(1)) && near(back(2))) return "きょうも この時間に きてくれた";

  return null;
}
