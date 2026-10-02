import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const SHOULDER_L = 11;
const SHOULDER_R = 12;
const ELBOW_L = 13;
const ELBOW_R = 14;
const WRIST_L = 15;
const WRIST_R = 16;

// しっかり腕を曲げ伸ばしすることを要求（ゆるすぎる誤カウントを防止）
const UP_ANGLE = 152;
const DOWN_ANGLE = 100;

export type PushupPhase = "up" | "descending" | "down" | "ascending";

export class PushupCounter {
  private phase: PushupPhase = "up";
  private lastRepAt = 0;
  private readonly minRepIntervalMs = 700;

  reset() {
    this.phase = "up";
    this.lastRepAt = 0;
  }

  getPhase(): PushupPhase {
    return this.phase;
  }

  update(landmarks: NormalizedLandmark[] | undefined, now: number): number {
    if (!landmarks || landmarks.length < 17) return 0;

    const angleL = jointAngle(landmarks[SHOULDER_L], landmarks[ELBOW_L], landmarks[WRIST_L]);
    const angleR = jointAngle(landmarks[SHOULDER_R], landmarks[ELBOW_R], landmarks[WRIST_R]);
    const angles = [angleL, angleR].filter((a): a is number => a != null);
    if (angles.length === 0) return 0;
    const angle = angles.reduce((a, b) => a + b, 0) / angles.length;

    switch (this.phase) {
      case "up":
        if (angle < UP_ANGLE - 20) this.phase = "descending";
        break;
      case "descending":
        if (angle < DOWN_ANGLE) this.phase = "down";
        else if (angle > UP_ANGLE) this.phase = "up";
        break;
      case "down":
        if (angle > DOWN_ANGLE + 15) this.phase = "ascending";
        break;
      case "ascending":
        if (angle > UP_ANGLE) {
          this.phase = "up";
          if (now - this.lastRepAt > this.minRepIntervalMs) {
            this.lastRepAt = now;
            return 1;
          }
        } else if (angle < DOWN_ANGLE) {
          this.phase = "down";
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
