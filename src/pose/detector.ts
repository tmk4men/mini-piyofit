import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

let landmarker: PoseLandmarker | null = null;
let initPromise: Promise<PoseLandmarker> | null = null;

// WASM とモデルはアプリ内にバンドル（public/mediapipe 配下）。
// 以前は CDN(jsdelivr) と Google Cloud Storage から実行時取得していたが、
// App Store 審査環境やオフライン・不安定回線で取得に失敗し、カメラ起動時に
// エラーになる原因だったため、外部通信をなくして端末内だけで完結させる。
const BASE = import.meta.env.BASE_URL; // 通常は "/"
const WASM_BASE = `${BASE}mediapipe/wasm`;
const MODEL_URL = `${BASE}mediapipe/pose_landmarker_lite.task`;

async function createLandmarker(
  delegate: "GPU" | "CPU",
): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate,
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export async function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (landmarker) return landmarker;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      landmarker = await createLandmarker("GPU");
    } catch (err) {
      // 一部の端末/WebView では GPU デリゲートが使えないことがあるため
      // CPU にフォールバックする。
      console.warn("[pose] GPU delegate failed, falling back to CPU", err);
      landmarker = await createLandmarker("CPU");
    }
    return landmarker;
  })();
  try {
    return await initPromise;
  } catch (err) {
    // 失敗時は次回リトライできるよう状態をリセット。
    initPromise = null;
    throw err;
  }
}

export type DetectResult = PoseLandmarkerResult;
