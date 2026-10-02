import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { SquatCounter } from "./squatCounter";
import { PushupCounter } from "./pushupCounter";

export type ExerciseKind = "squat" | "pushup";

export interface ExerciseCounter {
  update(landmarks: NormalizedLandmark[] | undefined, now: number): number;
  getPhase(): string;
  reset(): void;
}

export function createCounter(kind: ExerciseKind): ExerciseCounter {
  return kind === "squat" ? new SquatCounter() : new PushupCounter();
}

export const EXERCISE_META: Record<ExerciseKind, { label: string; hint: string }> = {
  squat: { label: "スクワット", hint: "しょうめんを むいて、ぜんしんが うつるように" },
  pushup: { label: "うでたて", hint: "よこを むいて、うで ぜんぶが うつるように" },
};

export function labelPhase(kind: ExerciseKind, phase: string): string {
  if (kind === "squat") {
    switch (phase) {
      case "standing": return "たってるよ";
      case "descending": return "しゃがんで…";
      case "squatting": return "そこ！";
      case "ascending": return "たちあがれ！";
    }
  } else {
    switch (phase) {
      case "up": return "うで のびてる";
      case "descending": return "さがって…";
      case "down": return "そこ！";
      case "ascending": return "おしあげ！";
    }
  }
  return phase;
}
