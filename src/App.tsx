import { useEffect, useRef, useState } from "react";
import { useGame } from "./game/store";
import { stageOf } from "./game/rules";
import { CLEAN_LINES, NO_POOP_LINES, PAT_LINES, pick } from "./game/lines";
import { Room } from "./ui/Room";
import { ExerciseScreen } from "./ui/ExerciseScreen";
import { Confetti, HelpCard, OverlayLayer } from "./ui/Overlays";
import { OutingPanel, ShopPanel } from "./ui/Panels";
import { Menu } from "./ui/Menu";
import {
  IconBag,
  IconBowl,
  IconClose,
  IconCoin,
  IconDumbbell,
  IconMenu,
  IconPushup,
  IconSparkle,
  IconSquat,
  IconTrip,
} from "./ui/icons";
import type { ExerciseKind } from "./pose/exercise";
import { playCleanSfx, playClickSfx, playPetSfx, preloadAllSfx, unlockAudio } from "./sfx/sfx";
import { pauseBgm, resumeBgm, startBgm } from "./sfx/bgm";

function ToyButton({
  label,
  onPress,
  children,
  size = "mid",
  disabled,
  active,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  size?: "small" | "mid" | "big";
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <div className={`toy-btn is-${size}${active ? " is-active" : ""}`}>
      <button type="button" onClick={onPress} disabled={disabled} aria-label={label} aria-pressed={active}>
        {children}
      </button>
      <span>{label}</span>
    </div>
  );
}

export default function App() {
  const pet = useGame((s) => s.pet);
  const coins = useGame((s) => s.coins);
  const mode = useGame((s) => s.mode);
  const overlays = useGame((s) => s.overlays);
  const seenHelp = useGame((s) => s.seenHelp);
  const g = useGame.getState;
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(!seenHelp);
  const [kind, setKind] = useState<ExerciseKind>("squat");
  const [coinBump, setCoinBump] = useState(0);
  const prevCoins = useRef(coins);
  const audioReady = useRef(false);

  const stage = stageOf(pet);
  const isEgg = stage.id === "egg";

  useEffect(() => {
    g().sync();
    const t = setInterval(() => g().sync(), 1000);
    const vis = () => {
      if (document.hidden) pauseBgm();
      else {
        g().sync();
        resumeBgm();
      }
    };
    document.addEventListener("visibilitychange", vis);
    (window as unknown as { __miniReady: boolean }).__miniReady = true;
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [g]);

  // コインが ふえたら ピルを はねさせる
  useEffect(() => {
    if (coins > prevCoins.current) setCoinBump((b) => b + 1);
    prevCoins.current = coins;
  }, [coins]);

  // 音は 最初の タップで はじめて 鳴らせる
  const wakeAudio = () => {
    if (audioReady.current) return;
    audioReady.current = true;
    unlockAudio();
    preloadAllSfx();
    void startBgm();
  };

  const onClean = () => {
    if (g().doClean()) {
      playCleanSfx();
      g().say(pick(CLEAN_LINES));
    } else {
      playClickSfx();
      g().say(pick(NO_POOP_LINES));
    }
  };
  const onPat = () => {
    g().doPat();
    playPetSfx();
    if (!isEgg) g().say(pick(PAT_LINES));
  };
  const toggle = (m: "shop" | "food" | "outing") => {
    playClickSfx();
    g().setMode(mode === m ? "home" : m);
  };
  const home = () => g().setMode("home");

  const exercising = mode === "exercise";
  const top = overlays[0];
  const blocked = !!top;
  const name = pet.name || (isEgg ? "たまご" : "？？？");

  return (
    <div className="app" onPointerDownCapture={wakeAudio}>
      <div className="toy">
        <header className="toy-head">
          <span className="coin-pill" key={coinBump} aria-label={`コイン ${coins}`}>
            <IconCoin size={18} /> {coins}
          </span>
          <div className="toy-title">
            <span className="toy-gen">{pet.gen}だいめ</span>
            <h1 className="toy-name">{name}</h1>
          </div>
          <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="メニュー">
            <IconMenu />
          </button>
        </header>

        <main className="toy-screen">
          <div className="screen-inner">
            {exercising ? <ExerciseScreen kind={kind} /> : <Room onPat={onPat} />}
            {mode === "shop" && <ShopPanel onClose={home} />}
            {mode === "food" && <ShopPanel foodOnly onClose={home} />}
            {mode === "outing" && <OutingPanel onClose={home} />}
            {!exercising && <OverlayLayer />}
            {!exercising && helpOpen && !top && (
              <HelpCard
                onClose={() => {
                  setHelpOpen(false);
                  g().markHelpSeen();
                }}
              />
            )}
          </div>
        </main>

        <nav className="toy-buttons" aria-label="そうさ">
          {exercising ? (
            <>
              <ToyButton label="スクワット" onPress={() => setKind("squat")} active={kind === "squat"}>
                <IconSquat size={28} />
              </ToyButton>
              <ToyButton label="おわる" size="big" onPress={home}>
                <IconClose size={32} />
              </ToyButton>
              <ToyButton label="うでたて" onPress={() => setKind("pushup")} active={kind === "pushup"}>
                <IconPushup size={28} />
              </ToyButton>
            </>
          ) : (
            <>
              <ToyButton label="おみせ" size="small" onPress={() => toggle("shop")} disabled={blocked} active={mode === "shop"}>
                <IconBag size={22} />
              </ToyButton>
              <ToyButton label="ごはん" onPress={() => toggle("food")} disabled={blocked} active={mode === "food"}>
                <IconBowl size={28} />
              </ToyButton>
              <ToyButton label="うんどう" size="big" onPress={() => g().setMode("exercise")} disabled={blocked}>
                <IconDumbbell size={36} />
              </ToyButton>
              <ToyButton label="そうじ" onPress={onClean} disabled={blocked || mode !== "home"}>
                <IconSparkle size={28} />
              </ToyButton>
              <ToyButton label="おでかけ" size="small" onPress={() => toggle("outing")} disabled={blocked} active={mode === "outing"}>
                <IconTrip size={22} />
              </ToyButton>
            </>
          )}
        </nav>
      </div>

      {!exercising && top?.kind === "grew" && <Confetti key={overlays.length} />}
      {!exercising && top?.kind === "ending" && top.ending === "marry" && <Confetti key={`m${overlays.length}`} />}
      {menuOpen && <Menu onClose={() => setMenuOpen(false)} onHelp={() => setHelpOpen(true)} />}
    </div>
  );
}
