import { useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  FiPlay,
  FiPause,
  FiSquare,
  FiFastForward,
  FiFolder,
} from "react-icons/fi";
import { usePlaybackStore } from "../../stores/playback-store";
import { formatElapsed } from "../../types/recorder";
import { useI18n } from "../../i18n";

const SPEEDS = [0.25, 0.5, 1, 2, 4];

export function PlaybackBar() {
  const { t } = useI18n();
  const { state, duration, position, speed, filePath, error, load, play, pause, stop, seek, setSpeed } =
    usePlaybackStore();
  const sliderRef = useRef<HTMLInputElement>(null);

  const fraction = duration > 0 ? position / duration : 0;
  const loaded = duration > 0;

  const handleOpen = async () => {
    const chosen = await open({
      title: t("playback.openFile"),
      filters: [{ name: "JSONL", extensions: ["jsonl"] }],
      multiple: false,
    });
    if (!chosen || Array.isArray(chosen)) return;
    try {
      const content = await readTextFile(chosen);
      load(content, chosen);
    } catch (e) {
      usePlaybackStore.getState().setError(String(e));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const fileName = filePath.split(/[\\/]/).pop() ?? "";

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/80 border-b border-zinc-800 text-xs shrink-0">
      {/* Open file */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 h-6 px-2 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors shrink-0"
        title={t("playback.openFile")}
      >
        <FiFolder className="w-3 h-3" />
        <span className="max-w-[120px] truncate text-[10px]">
          {fileName || t("playback.noFile")}
        </span>
      </button>

      {/* Controls */}
      {state === "playing" ? (
        <button
          onClick={pause}
          disabled={!loaded}
          className="flex items-center justify-center w-6 h-6 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-30 transition-colors"
          title={t("playback.pause")}
        >
          <FiPause className="w-3 h-3" />
        </button>
      ) : (
        <button
          onClick={play}
          disabled={!loaded}
          className="flex items-center justify-center w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-30 transition-colors"
          title={t("playback.play")}
        >
          <FiPlay className="w-3 h-3" />
        </button>
      )}
      <button
        onClick={stop}
        disabled={!loaded}
        className="flex items-center justify-center w-6 h-6 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-30 transition-colors"
        title={t("playback.stop")}
      >
        <FiSquare className="w-3 h-3" />
      </button>

      {/* Timeline */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-[10px] text-zinc-500 font-mono w-10 shrink-0 text-right">
          {formatElapsed(position)}
        </span>
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={1}
          step={0.0001}
          value={fraction}
          onChange={handleSeek}
          disabled={!loaded}
          className="flex-1 h-1 accent-sky-500 disabled:opacity-30"
        />
        <span className="text-[10px] text-zinc-600 font-mono w-10 shrink-0">
          {formatElapsed(duration)}
        </span>
      </div>

      {/* Speed */}
      <div className="flex items-center gap-1 shrink-0">
        <FiFastForward className="w-2.5 h-2.5 text-zinc-500" />
        <select
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-[10px] px-1 focus:outline-none"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>{s}x</option>
          ))}
        </select>
      </div>

      {/* Status pill */}
      {loaded && (
        <span className="text-[10px] text-zinc-600 shrink-0">
          {state === "playing"
            ? "▶"
            : state === "paused"
            ? "⏸"
            : "■"}
        </span>
      )}

      {error && (
        <span className="text-[10px] text-red-400 ml-1 truncate max-w-[200px]" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
