import { useState } from "react";
import { useGame } from "../game/store";
import { isBgmMuted, isSfxMuted, toggleBgm, toggleSfx } from "../sfx/bgm";
import { IconBook, IconClose, IconMusic, IconQuestion, IconRestart, IconSpeaker } from "./icons";
import { asset } from "../asset";
import { isAtPaywall } from "../game/rules";
import { isNative, restoreUnlock } from "../native/bridge";

type View = "menu" | "album" | "reset";

export function Menu({ onClose, onHelp }: { onClose: () => void; onHelp: () => void }) {
  const [view, setView] = useState<View>("menu");
  const [bgmOff, setBgmOff] = useState(isBgmMuted());
  const [sfxOff, setSfxOff] = useState(isSfxMuted());
  const album = useGame((s) => s.album);
  const resetAll = useGame((s) => s.resetAll);
  const unlocked = useGame((s) => s.unlocked);
  const pet = useGame((s) => s.pet);
  const stepsFrom = useGame((s) => s.stepsFrom);
  const g = useGame.getState;
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{view === "album" ? "アルバム" : view === "reset" ? "はじめから" : "メニュー"}</h2>
          <button type="button" className="icon-btn" onClick={view === "menu" ? onClose : () => setView("menu")} aria-label="とじる">
            <IconClose />
          </button>
        </div>

        {view === "menu" && (
          <ul className="menu-list">
            <li>
              <button type="button" onClick={() => setBgmOff(toggleBgm())}>
                <IconMusic /> おんがく <span className={`switch${bgmOff ? "" : " on"}`} />
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setSfxOff(toggleSfx())}>
                <IconSpeaker /> こうかおん <span className={`switch${sfxOff ? "" : " on"}`} />
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setView("album")}>
                <IconBook /> アルバム <span className="menu-meta">{album.length}わ</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onHelp();
                }}
              >
                <IconQuestion /> あそびかた
              </button>
            </li>
            {!unlocked && (
              <>
                <li>
                  <button type="button" onClick={() => { g().showPaywall(); onClose(); }}>
                    <IconBook /> つづきを そだてる {isAtPaywall(pet) && <span className="menu-meta">いま ここ</span>}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => void restoreUnlock().then((r) => {
                      if (r === "ok") { g().unlock(); setNote("ふくげん しました"); }
                      else setNote(r === "none" ? "買った きろくが みつからないよ" : "いまは ふくげん できないよ");
                    })}
                  >
                    <IconRestart /> 買った きろくを ふくげん
                  </button>
                </li>
              </>
            )}
            <li>
              <button
                type="button"
                onClick={() => {
                  if (!stepsFrom) { g().answerSteps(false); g().setMode("home"); useGame.setState((s) => ({ overlays: [...s.overlays, { kind: "askSteps" }] })); onClose(); }
                  else setNote("とどかない ときは iPhoneの せってい > ヘルスケア > データアクセス で ゆるしてね");
                }}
              >
                <IconSpeaker /> 歩数 <span className="menu-meta">{stepsFrom ? "つかう" : "つかわない"}</span>
              </button>
            </li>
            {!isNative() && (
              <>
                <li><button type="button" onClick={() => { g().receiveSteps([{ day: `試作${Date.now()}`, steps: 6000 }]); onClose(); }}><IconSpeaker /> 試作: 6000ほ あるいた</button></li>
                <li><button type="button" onClick={() => { g().devAdvance(24); onClose(); }}><IconRestart /> 試作: 1にち すすめる</button></li>
                <li><button type="button" onClick={() => { g().exercise(5); onClose(); }}><IconRestart /> 試作: 5かい うごいた</button></li>
              </>
            )}
            {note && <li><p className="menu-note">{note}</p></li>}
            <li>
              <button type="button" className="danger" onClick={() => setView("reset")}>
                <IconRestart /> はじめから
              </button>
            </li>
          </ul>
        )}

        {view === "album" &&
          (album.length === 0 ? (
            <p className="empty">まだ だれも ひとりだち していないよ。<br />おとなまで そだてると ここに のこる</p>
          ) : (
            <ul className="album">
              {album.map((a) => (
                <li key={a.endedAt}>
                  <img src={asset(a.ending === "runaway" ? "piyo_egg.webp" : "piyo_graduated.webp")} alt="" />
                  <div>
                    <p className="album-name">
                      {a.gen}だいめ <b>{a.name}</b>
                    </p>
                    <p className="album-meta">
                      {a.ending === "marry" ? `${a.spouse}と けっこん` : a.ending === "leave" ? "ひとりだち" : "いえで"}・{a.days}にち・{a.reps}かい
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {view === "reset" && (
          <div className="reset">
            <p>いまの こと アルバムが ぜんぶ きえて、1だいめの たまごから やりなおすよ。</p>
            <button
              type="button"
              className="pill danger"
              onClick={() => {
                resetAll();
                onClose();
              }}
            >
              けして はじめから
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
