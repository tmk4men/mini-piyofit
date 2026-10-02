import { useEffect, useRef, useState } from "react";
import { getPoseLandmarker } from "../pose/detector";
import { createCounter, EXERCISE_META, labelPhase, type ExerciseCounter, type ExerciseKind } from "../pose/exercise";
import { useGame } from "../game/store";
import { pick, REP_LINES } from "../game/lines";
import { playRepSfx } from "../sfx/sfx";
import { kickBgm } from "../sfx/bgm";
import { REP_COINS } from "../game/economy";
import { PetFigure } from "./PetFigure";
import { IconCoin } from "./icons";

type Status = "loading" | "ready" | "denied" | "error";

export function ExerciseScreen({ kind }: { kind: ExerciseKind }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const counterRef = useRef<ExerciseCounter>(createCounter(kind));
  const [status, setStatus] = useState<Status>("loading");
  const [phase, setPhase] = useState("");
  const [session, setSession] = useState(0);
  const [cheer, setCheer] = useState({ n: 0, text: "", reps: 1 });
  const [attempt, setAttempt] = useState(0);
  const exercise = useGame((s) => s.exercise);

  const onRep = (n: number) => {
    exercise(n);
    setSession((x) => x + n);
    setCheer((c) => ({ n: c.n + 1, text: pick(REP_LINES), reps: n }));
    playRepSfx();
    navigator.vibrate?.(15);
  };
  const onRepRef = useRef(onRep);
  onRepRef.current = onRep;

  useEffect(() => {
    counterRef.current = createCounter(kind);
    setPhase(counterRef.current.getPhase());
  }, [kind]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    setStatus("loading");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("nocamera");
        const landmarker = await getPoseLandmarker();
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) return;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        if (cancelled) return;
        setStatus("ready");
        // iOS は カメラ起動で 音の出力が 奪われるので BGM を 鳴らし直す
        kickBgm();
        setTimeout(() => !cancelled && kickBgm(), 400);
        let lastPhase = "";
        const loop = () => {
          if (cancelled) return;
          if (v.readyState >= 2) {
            const now = performance.now();
            const res = landmarker.detectForVideo(v, now);
            const reps = counterRef.current.update(res.landmarks?.[0], now);
            if (reps > 0) onRepRef.current(reps);
            const ph = counterRef.current.getPhase();
            if (ph !== lastPhase) {
              lastPhase = ph;
              setPhase(ph);
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [attempt]);

  const meta = EXERCISE_META[kind];

  return (
    <div className="ex">
      <video ref={videoRef} className="ex-video" playsInline muted />

      <div className="ex-top">
        <span className="ex-kind">{meta.label}</span>
        {status === "ready" && <span className="ex-phase">{labelPhase(kind, phase)}</span>}
      </div>

      {status === "loading" && <p className="ex-msg">カメラを じゅんびしてるよ…</p>}
      {(status === "denied" || status === "error") && (
        <div className="ex-msg">
          <p>
            {status === "denied" ? "カメラが つかえないみたい。" : "カメラを ひらけなかったよ。"}
            <br />
            うんどうは カメラで かぞえるよ。
            {status === "denied" && (
              <>
                <br />
                せっていで カメラを ゆるしてから もういちど
              </>
            )}
          </p>
          <button type="button" className="pill mini" onClick={() => setAttempt((a) => a + 1)}>
            もういちど
          </button>
        </div>
      )}

      {status === "ready" && (
        <div className="ex-countwrap">
          <span className="ex-count" key={session}>{session}</span>
        </div>
      )}

      {status === "ready" && session === 0 && <p className="ex-hint">{meta.hint}</p>}

      <div className="ex-buddy">
        {cheer.n > 0 && (
          <span className="ex-cheer" key={`c${cheer.n}`}>
            {cheer.text}
            <b className="ex-coin">
              <IconCoin size={14} /> +{REP_COINS * cheer.reps}
            </b>
          </span>
        )}
        <PetFigure key={`i${cheer.n}`} className="ex-buddy-img" />
      </div>
    </div>
  );
}
