import { useSbusStore } from "../../stores/sbus-store";
import { useSbusData } from "../../hooks/use-sbus-data";
import { normalizeChannel } from "../../types/sbus";
import { SbusToolbar } from "./SbusToolbar";
import { cn } from "../../lib/utils";
import { useI18n } from "../../i18n";

/** Pure raw channel bar — no mapping, no labels, just the number and a bar */
function RawChannelBar({ index, value }: { index: number; value: number }) {
  const fillPct = normalizeChannel(value) * 100;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] text-zinc-500 font-mono w-7 shrink-0 text-right">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="relative flex-1 h-3.5 bg-zinc-800/80 rounded overflow-hidden">
        {/* Center marker */}
        <div className="absolute top-0 h-full w-px bg-zinc-600/80 z-10" style={{ left: "50%" }} />
        <div
          className="absolute top-0 left-0 h-full bg-sky-500/60"
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-400 font-mono w-10 text-right shrink-0 tabular-nums">
        {value}
      </span>
    </div>
  );
}

/** Raw channel view — 16 bars, no preset mapping */
export function RawChannelsPage() {
  const { t } = useI18n();
  useSbusData();

  const { data, stats, connected, signalLost } = useSbusStore();
  const ch = data.channels;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <SbusToolbar />

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-300">{t("remote.channels.raw.title")}</span>
              <span className="text-[10px] text-zinc-600 font-mono">{t("remote.channels.raw.range")}</span>
            </div>
            <div className="flex items-center gap-2">
              {data.failsafe && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">{t("remote.badge.failsafe")}</span>
              )}
              {data.frame_lost && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">{t("remote.badge.frameLost")}</span>
              )}
              {!connected && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-500">{t("remote.badge.notConnected")}</span>
              )}
            </div>
          </div>

          {/* 16-channel grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="border-b md:border-b-0 md:border-r border-zinc-800 md:pr-6 pb-3 md:pb-0">
              <div className="flex justify-between text-[9px] text-zinc-600 font-mono mb-1 px-9">
                <span>172</span><span>↑ mid</span><span>1811</span>
              </div>
              {ch.slice(0, 8).map((val, i) => (
                <RawChannelBar key={i} index={i} value={val} />
              ))}
            </div>
            <div className="md:pl-6 pt-3 md:pt-0">
              <div className="flex justify-between text-[9px] text-zinc-600 font-mono mb-1 px-9">
                <span>172</span><span>↑ mid</span><span>1811</span>
              </div>
              {ch.slice(8, 16).map((val, i) => (
                <RawChannelBar key={i + 8} index={i + 8} value={val} />
              ))}
            </div>
          </div>

          {/* CH17 / CH18 */}
          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <span className="text-[10px] text-zinc-500 font-mono shrink-0">{t("remote.digital.label")}</span>
            {[{ label: "CH17", active: data.ch17 }, { label: "CH18", active: data.ch18 }].map(({ label, active }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={cn("w-2.5 h-2.5 rounded-full border",
                  active ? "bg-sky-400 border-sky-400/50" : "bg-zinc-700 border-zinc-600"
                )} />
                <span className={cn("text-[10px] font-mono", active ? "text-sky-400" : "text-zinc-600")}>{label}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-5 text-[10px] text-zinc-500 font-mono bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
            <span className="text-zinc-400 font-sans mr-1">{t("remote.stats.label")}</span>
            <span>{t("remote.stats.bytes")} <span className="text-zinc-300">{stats.bytes_received.toLocaleString()}</span></span>
            <span>{t("remote.stats.rx")} <span className="text-zinc-300">{stats.frames_received.toLocaleString()}</span></span>
            <span>{t("remote.stats.invalid")} <span className={stats.frames_invalid > 0 ? "text-amber-400" : "text-zinc-300"}>{stats.frames_invalid}</span></span>
            <span>{t("remote.stats.lost")} <span className={stats.frames_lost > 0 ? "text-red-400" : "text-zinc-300"}>{stats.frames_lost}</span></span>
            {connected && !signalLost && stats.frames_received > 0 && (
              <span className="ml-auto text-emerald-500/80">{t("remote.stats.live")}</span>
            )}
            {connected && stats.bytes_received > 0 && stats.frames_received === 0 && (
              <span className="ml-auto text-amber-400/80">{t("remote.stats.badBaud")}</span>
            )}
            {connected && stats.bytes_received === 0 && (
              <span className="ml-auto text-zinc-500/80">{t("remote.stats.waiting")}</span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
