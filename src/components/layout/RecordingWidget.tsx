import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { FiCircle, FiSquare } from "react-icons/fi";
import { useRecorderStore } from "../../stores/recorder-store";
import { useRecorderStatus } from "../../hooks/use-recorder-status";
import { formatElapsed, totalFrames } from "../../types/recorder";
import { useI18n } from "../../i18n";

/**
 * Global recording control shown in AppNavbar.
 * - Click ▶ to choose a save path and start recording
 * - Click ■ to stop; status auto-refreshes while recording
 */
export function RecordingWidget() {
  const { t } = useI18n();
  const { status, start, stop } = useRecorderStore();
  useRecorderStatus(); // poll while recording
  const [busy, setBusy] = useState(false);

  const handleStart = async () => {
    setBusy(true);
    try {
      // Show save dialog; if cancelled (null), do NOT start recording
      const chosen = await save({
        title: t("rec.record"),
        defaultPath: `rec_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.jsonl`,
        filters: [{ name: "JSONL", extensions: ["jsonl"] }],
      });
      if (chosen === null) return; // user cancelled — abort
      await start(chosen);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    await stop();
  };

  if (status.recording) {
    return (
      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded px-2 py-0.5">
        <FiCircle className="w-2.5 h-2.5 text-red-500 fill-red-500 animate-pulse" />
        <span className="text-[10px] font-mono text-red-400">
          {formatElapsed(status.elapsed_secs)}
        </span>
        <span className="text-[10px] text-zinc-500">
          {totalFrames(status).toLocaleString()} {t("rec.frames")}
        </span>
        <button
          onClick={handleStop}
          className="flex items-center gap-1 ml-1 px-2 h-6 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          title={t("rec.stop")}
        >
          <FiSquare className="w-2.5 h-2.5" />
          {t("rec.stop")}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleStart}
      disabled={busy}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors disabled:opacity-50"
      title={t("rec.tip")}
    >
      <FiCircle className="w-2.5 h-2.5 text-red-500 fill-red-500" />
      {t("rec.record")}
    </button>
  );
}
