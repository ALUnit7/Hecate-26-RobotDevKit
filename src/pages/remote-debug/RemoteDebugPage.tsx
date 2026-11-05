import { useState, useEffect } from "react";
import {
  FiActivity,
} from "react-icons/fi";
import { useSbusData } from "../../hooks/use-sbus-data";
import { useSbusStore } from "../../stores/sbus-store";
import { usePresetStore, selectChannelMapping } from "../../stores/preset-store";
import { normalizeChannel } from "../../types/sbus";
import { SW_LOW, SW_HIGH, type ChannelMapping } from "../../types/presets";
import { cn } from "../../lib/utils";
import { SbusToolbar } from "./SbusToolbar";
import { PresetToolbar } from "./PresetToolbar";
import { PresetEditor } from "./PresetEditor";
import { VirtualStick } from "./VirtualStick";

// ── Channel renderers by type ──────────────────────────────────────────────

function ChannelStick({ value }: { value: number }) {
  const fillPct = normalizeChannel(value) * 100;
  return (
    <div className="relative flex-1 h-3.5 bg-zinc-800/80 rounded overflow-hidden">
      <div className="absolute top-0 h-full w-px bg-zinc-600/80 z-10" style={{ left: "50%" }} />
      <div className="absolute top-0 left-0 h-full bg-sky-500/70" style={{ width: `${fillPct}%` }} />
    </div>
  );
}

function ChannelKnob({ value }: { value: number }) {
  const fillPct = normalizeChannel(value) * 100;
  return (
    <div className="relative flex-1 h-3.5 bg-zinc-800/80 rounded overflow-hidden">
      <div className="absolute top-0 left-0 h-full bg-violet-500/60" style={{ width: `${fillPct}%` }} />
    </div>
  );
}

function ChannelSwitch2({ value }: { value: number }) {
  const pos = value > SW_HIGH ? "down" : "up";
  return (
    <div className="flex-1 flex items-center gap-1.5">
      {(["up", "down"] as const).map((p) => (
        <span
          key={p}
          className={cn(
            "text-[9px] font-mono px-2 py-0.5 rounded border",
            pos === p
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
              : "bg-zinc-800/50 border-zinc-700 text-zinc-600"
          )}
        >
          {p === "up" ? "↑ UP" : "↓ DOWN"}
        </span>
      ))}
    </div>
  );
}

function ChannelSwitch3({ value }: { value: number }) {
  const pos = value < SW_LOW ? "up" : value > SW_HIGH ? "down" : "mid";
  return (
    <div className="flex-1 flex items-center gap-1.5">
      {(["up", "mid", "down"] as const).map((p) => (
        <span
          key={p}
          className={cn(
            "text-[9px] font-mono px-2 py-0.5 rounded border",
            pos === p
              ? "bg-sky-500/20 border-sky-500/40 text-sky-400"
              : "bg-zinc-800/50 border-zinc-700 text-zinc-600"
          )}
        >
          {p === "up" ? "↑" : p === "mid" ? "— MID" : "↓"}
        </span>
      ))}
    </div>
  );
}

function ChannelSpring({ value }: { value: number }) {
  const pressed = value > SW_HIGH;
  return (
    <div className="flex-1 flex items-center gap-2">
      <div
        className={cn(
          "w-3 h-3 rounded-full border-2 transition-colors",
          pressed
            ? "bg-amber-400 border-amber-400/60"
            : "bg-zinc-700 border-zinc-600"
        )}
      />
      <span className={cn("text-[10px] font-mono", pressed ? "text-amber-400" : "text-zinc-600")}>
        {pressed ? "PRESSED" : "RELEASED"}
      </span>
    </div>
  );
}

function ChannelTrim({ value }: { value: number }) {
  const fillPct = normalizeChannel(value) * 100;
  const offset = ((value - 992) / 819) * 100;
  return (
    <div className="relative flex-1 h-3.5 bg-zinc-800/80 rounded overflow-hidden">
      <div className="absolute top-0 h-full w-px bg-zinc-600/80 z-10" style={{ left: "50%" }} />
      <div
        className="absolute top-0 h-full bg-zinc-400/50"
        style={{ width: `${fillPct}%` }}
      />
      <span className="absolute right-1 top-0 text-[8px] text-zinc-500 leading-3.5 h-3.5 flex items-center">
        {offset >= 0 ? "+" : ""}{offset.toFixed(0)}%
      </span>
    </div>
  );
}

function ChannelUnassigned({ value }: { value: number }) {
  const fillPct = normalizeChannel(value) * 100;
  return (
    <div className="relative flex-1 h-3.5 bg-zinc-800/50 rounded overflow-hidden">
      <div className="absolute top-0 left-0 h-full bg-zinc-600/40" style={{ width: `${fillPct}%` }} />
    </div>
  );
}

// ── Unified channel row ────────────────────────────────────────────────────

function ChannelRow({ index, value, mapping }: {
  index: number;
  value: number;
  mapping: ChannelMapping;
}) {
  const { channelType, label, control } = mapping;

  const renderer = () => {
    switch (channelType) {
      case "stick":        return <ChannelStick value={value} />;
      case "knob":
      case "lever":        return <ChannelKnob value={value} />;
      case "switch2":      return <ChannelSwitch2 value={value} />;
      case "switch3":      return <ChannelSwitch3 value={value} />;
      case "switchSpring": return <ChannelSpring value={value} />;
      case "trim":         return <ChannelTrim value={value} />;
      default:             return <ChannelUnassigned value={value} />;
    }
  };

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Channel number */}
      <span className="text-[10px] text-zinc-600 font-mono w-5 shrink-0 text-right">
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Control + label */}
      <div className="flex flex-col w-20 shrink-0 min-w-0">
        {control && (
          <span className="text-[9px] text-zinc-500 font-mono leading-tight truncate">
            {control}
          </span>
        )}
        <span className={cn(
          "text-[10px] leading-tight truncate",
          channelType === "unassigned" ? "text-zinc-600" : "text-zinc-300"
        )}>
          {label}
        </span>
      </div>

      {/* Type-specific visualization */}
      {renderer()}

      {/* Raw value */}
      <span className="text-[10px] text-zinc-500 font-mono w-9 text-right shrink-0 tabular-nums">
        {value}
      </span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function RemoteDebugPage() {
  useSbusData();

  const { data, stats, connected, signalLost } = useSbusStore();
  const presetStore = usePresetStore();
  const [editorOpen, setEditorOpen] = useState(false);

  // Load presets on first mount
  useEffect(() => {
    if (!presetStore.loaded) presetStore.load();
  }, [presetStore]);

  const ch = data.channels;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Row 1: Serial connection */}
      <SbusToolbar />

      {/* Row 2: Preset management */}
      <PresetToolbar onEditChannels={() => setEditorOpen(true)} />

      {/* Channel mapping editor modal */}
      {editorOpen && <PresetEditor onClose={() => setEditorOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Status badges row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiActivity className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-300">Channels</h2>
              <span className="text-[10px] text-zinc-600 font-mono">raw 172 – 1811 · mid 992</span>
            </div>
            <div className="flex items-center gap-2">
              {data.failsafe && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                  FAILSAFE
                </span>
              )}
              {data.frame_lost && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                  FRAME LOST
                </span>
              )}
              {!connected && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-500">
                  Not connected
                </span>
              )}
            </div>
          </div>

          {/* 16-channel grid: two columns of 8 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="border-b md:border-b-0 md:border-r border-zinc-800 md:pr-5 pb-3 md:pb-0">
              {ch.slice(0, 8).map((val, i) => (
                <ChannelRow
                  key={i}
                  index={i}
                  value={val}
                  mapping={selectChannelMapping(presetStore, i)}
                />
              ))}
            </div>
            <div className="md:pl-5 pt-3 md:pt-0">
              {ch.slice(8, 16).map((val, i) => (
                <ChannelRow
                  key={i + 8}
                  index={i + 8}
                  value={val}
                  mapping={selectChannelMapping(presetStore, i + 8)}
                />
              ))}
            </div>
          </div>

          {/* Virtual joystick display */}
          <VirtualStick />

          {/* Digital channels CH17 / CH18 */}
          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <span className="text-[10px] text-zinc-500 font-mono shrink-0">Digital</span>
            {[{ label: "CH17", active: data.ch17 }, { label: "CH18", active: data.ch18 }].map(({ label, active }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={cn("w-2.5 h-2.5 rounded-full border",
                  active ? "bg-sky-400 border-sky-400/50" : "bg-zinc-700 border-zinc-600"
                )} />
                <span className={cn("text-[10px] font-mono", active ? "text-sky-400" : "text-zinc-600")}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5 text-[10px] text-zinc-500 font-mono bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
            <span className="text-zinc-400 font-sans text-[10px] mr-1">Stats</span>
            <span>Bytes <span className="text-zinc-300">{stats.bytes_received.toLocaleString()}</span></span>
            <span>RX <span className="text-zinc-300">{stats.frames_received.toLocaleString()}</span></span>
            <span>Invalid <span className={stats.frames_invalid > 0 ? "text-amber-400" : "text-zinc-300"}>{stats.frames_invalid}</span></span>
            <span>Lost <span className={stats.frames_lost > 0 ? "text-red-400" : "text-zinc-300"}>{stats.frames_lost}</span></span>
            {connected && !signalLost && stats.frames_received > 0 && (
              <span className="ml-auto text-emerald-500/80">● live</span>
            )}
            {connected && stats.bytes_received > 0 && stats.frames_received === 0 && (
              <span className="ml-auto text-amber-400/80">● bytes in, no valid frames — check baud rate</span>
            )}
            {connected && stats.bytes_received === 0 && (
              <span className="ml-auto text-zinc-500/80">waiting for data…</span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
