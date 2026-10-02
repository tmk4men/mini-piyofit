import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const HIP_L = 23;
const HIP_R = 24;
const KNEE_L = 25;
const KNEE_R = 26;
const ANKLE_L = 27;
const ANKLE_R = 28;

// しっかり立ち・しっかりしゃがむ ことを要求して 誤カウントを防ぐ
const STAND_ANGLE = 158;
const SQUAT_ANGLE = 115;

export type SquatPhase = "standing" | "descending" | "squatting" | "ascending";

export class SquatCounter {
  private phase: SquatPhase = "standing";
  private lastRepAt = 0;
  private readonly minRepIntervalMs = 650;

  reset() {
    this.phase = "standing";
    this.lastRepAt = 0;
  }

  getPhase(): SquatPhase {
    return this.phase;
  }

  /** Returns 1 if a new rep was completed this frame, 0 otherwise. */
  update(landmarks: NormalizedLandmark[] | undefined, now: number): number {
    if (!landmarks || landmarks.length < 29) return 0;

    const angleL = jointAngle(landmarks[HIP_L], landmarks[KNEE_L], landmarks[ANKLE_L]);
    const angleR = jointAngle(landmarks[HIP_R], landmarks[KNEE_R], landmarks[ANKLE_R]);
    // 片側だけ見えていてもカウントできるように
    const angles = [angleL, angleR].filter((a): a is number => a != null);
    if (angles.length === 0) return 0;
    const angle = angles.reduce((a, b) => a + b, 0) / angles.length;

    switch (this.phase) {
      case "standing":
        if (angle < SQUAT_ANGLE + 20) this.phase = "descending";
        break;
      case "descending":
        if (angle < SQUAT_ANGLE) this.phase = "squatting";
        else if (angle > STAND_ANGLE) this.phase = "standing";
        break;
      case "squatting":
        if (angle > SQUAT_ANGLE + 20) this.phase = "ascending";
        break;
      case "ascending":
        if (angle > STAND_ANGLE) {
          this.phase = "standing";
          if (now - this.lastRepAt > this.minRepIntervalMs) {
            this.lastRepAt = now;
            return 1;
          }
        } else if (angle < SQUAT_ANGLE) {
          this.phase = "squatting";
        }
        break;
    }
    return 0;
  }
}

function jointAngle(
  a: NormalizedLandmark | undefined,
  b: NormalizedLandmark | undefined,
  c: NormalizedLandmark | undefined,
): number | null {
  if (!a || !b || !c) return null;
  // 遠目からでも見失いづらいように visibility 閾値を緩和
  if ((a.visibility ?? 1) < 0.25 || (b.visibility ?? 1) < 0.25 || (c.visibility ?? 1) < 0.25) {
    return null;
  }
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return null;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}
