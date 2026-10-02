import { useState } from "react";
import { useGame } from "../game/store";
import { isBgmMuted, isSfxMuted, toggleBgm, toggleSfx } from "../sfx/bgm";
import { IconBook, IconClose, IconMusic, IconQuestion, IconRestart, IconSpeaker } from "./icons";

type View = "menu" | "album" | "reset";

export function Menu({ onClose, onHelp }: { onClose: () => void; onHelp: () => void }) {
  const [view, setView] = useState<View>("menu");
  const [bgmOff, setBgmOff] = useState(isBgmMuted());
  const [sfxOff, setSfxOff] = useState(isSfxMuted());
  const album = useGame((s) => s.album);
  const resetAll = useGame((s) => s.resetAll);

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
                  <img src={a.ending === "runaway" ? "/piyo_egg.webp" : "/piyo_graduated.webp"} alt="" />
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
