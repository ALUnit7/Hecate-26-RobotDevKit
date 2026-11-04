import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FiRadio,
  FiRefreshCw,
  FiAlertTriangle,
  FiActivity,
} from "react-icons/fi";
import { useSbusData } from "../../hooks/use-sbus-data";
import { useSbusStore } from "../../stores/sbus-store";
import {
  normalizeChannel,
} from "../../types/sbus";
import type { PortInfo } from "../../types/imu";
import { cn } from "../../lib/utils";

// 100000 = standard SBUS (100kbps, inverted). 115200 = common USB-UART converters.
const BAUD_RATES = [100000, 115200, 200000];

// Stick channels (CH1-4) get accent coloring; rest use neutral slate.
const STICK_CHANNELS = new Set([0, 1, 2, 3]);

/** Single horizontal channel bar with center marker and raw value readout */
function ChannelBar({ index, value }: { index: number; value: number }) {
  const fillPct = normalizeChannel(value) * 100;
  const midPct = 50; // 1024/2047 ≈ 50%
  const isStick = STICK_CHANNELS.has(index);
  const fillClass = isStick ? "bg-sky-500/70" : "bg-emerald-500/60";

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] text-zinc-500 font-mono w-7 shrink-0 text-right">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="relative flex-1 h-3.5 bg-zinc-800/80 rounded overflow-hidden">
        {/* Center marker line */}
        <div
          className="absolute top-0 h-full w-px bg-zinc-600/80 z-10"
          style={{ left: `${midPct}%` }}
        />
        {/* Fill bar (no transition for real-time responsiveness) */}
        <div
          className={cn("absolute top-0 left-0 h-full", fillClass)}
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-400 font-mono w-10 text-right shrink-0 tabular-nums">
        {value}
      </span>
    </div>
  );
}
/** Toolbar: port selection, baud rate, connect/disconnect, status indicators */
function SbusToolbar() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const { connected, baudRate, signalLost, error, setConnected, setBaudRate, setError, reset } =
    useSbusStore();

  const refreshPorts = useCallback(async () => {
    try {
      const result = await invoke<PortInfo[]>("list_ports");
      setPorts(result);
      if (result.length > 0 && !selectedPort) {
        setSelectedPort(result[0].name);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [selectedPort, setError]);

  useEffect(() => {
    refreshPorts();
  }, [refreshPorts]);

  const handleConnect = async () => {
    setError("");
    try {
      if (connected) {
        await invoke("sbus_close_port");
        setConnected(false);
        reset();
      } else {
        await invoke("sbus_open_port", { portName: selectedPort, baudRate });
        setConnected(true, selectedPort);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs shrink-0 flex-wrap">
      {/* Port selector */}
      <select
        value={selectedPort}
        onChange={(e) => setSelectedPort(e.target.value)}
        disabled={connected}
        className="h-7 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-2 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
      >
        {ports.length === 0 && <option value="">No ports found</option>}
        {ports.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name} — {p.port_type}
          </option>
        ))}
      </select>
      <button
        onClick={refreshPorts}
        disabled={connected}
        className="h-7 w-7 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 flex items-center justify-center"
        title="Refresh ports"
      >
        <FiRefreshCw className="w-3 h-3" />
      </button>

      {/* Baud rate */}
      <select
        value={baudRate}
        onChange={(e) => setBaudRate(Number(e.target.value))}
        disabled={connected}
        className="h-7 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-2 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
      >
        {BAUD_RATES.map((b) => (
          <option key={b} value={b}>
            {b.toLocaleString()} baud
          </option>
        ))}
      </select>

      {/* Connect/Disconnect */}
      <button
        onClick={handleConnect}
        className={cn(
          "ml-1 flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium transition-colors",
          connected
            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
        )}
      >
        <FiRadio className="w-3 h-3" />
        {connected ? "Disconnect" : "Connect"}
      </button>

      {/* Status indicators */}
      <div className="ml-auto flex items-center gap-3">
        {signalLost && connected && (
          <span className="flex items-center gap-1 text-amber-400 text-[10px]">
            <FiAlertTriangle className="w-3 h-3" />
            Signal lost
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full", connected && !signalLost ? "bg-emerald-500" : connected ? "bg-amber-500" : "bg-zinc-600")} />
          <span className="text-zinc-400 text-[10px]">
            {!connected ? "Disconnected" : signalLost ? "No signal" : "Receiving"}
          </span>
        </div>
      </div>

      {error && (
        <span className="w-full text-red-400 text-[10px] mt-0.5">{error}</span>
      )}
    </div>
  );
}
/** Main SBUS Remote Debugger page */
export function RemoteDebugPage() {
  useSbusData();

  const { data, stats, connected, signalLost } = useSbusStore();
  const ch = data.channels;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <SbusToolbar />

      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Section header + status badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiActivity className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-300">Channels</h2>
              <span className="text-[10px] text-zinc-600 font-mono">
                raw 0 – 2047 · mid 1024
              </span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            {/* Left column: CH1–8 */}
            <div className="border-b md:border-b-0 md:border-r border-zinc-800 md:pr-6 pb-3 md:pb-0">
              <div className="flex justify-between text-[9px] text-zinc-600 font-mono mb-1 px-9">
                <span>0</span>
                <span>↑ mid</span>
                <span>2047</span>
              </div>
              {ch.slice(0, 8).map((val, i) => (
                <ChannelBar key={i} index={i} value={val} />
              ))}
            </div>

            {/* Right column: CH9–16 */}
            <div className="md:pl-6 pt-3 md:pt-0">
              <div className="flex justify-between text-[9px] text-zinc-600 font-mono mb-1 px-9">
                <span>0</span>
                <span>↑ mid</span>
                <span>2047</span>
              </div>
              {ch.slice(8, 16).map((val, i) => (
                <ChannelBar key={i + 8} index={i + 8} value={val} />
              ))}
            </div>
          </div>

          {/* Digital channels CH17 / CH18 */}
          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <span className="text-[10px] text-zinc-500 font-mono shrink-0">Digital</span>
            {[{ label: "CH17", active: data.ch17 }, { label: "CH18", active: data.ch18 }].map(({ label, active }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={cn("w-2.5 h-2.5 rounded-full border", active ? "bg-sky-400 border-sky-400/50" : "bg-zinc-700 border-zinc-600")} />
                <span className={cn("text-[10px] font-mono", active ? "text-sky-400" : "text-zinc-600")}>{label}</span>
              </div>
            ))}
            <span className="text-[10px] text-zinc-600 ml-2">
              {data.ch17 ? "ON" : "—"} / {data.ch18 ? "ON" : "—"}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5 text-[10px] text-zinc-500 font-mono bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
            <span className="text-zinc-400 font-sans text-[10px] mr-1">Stats</span>
            <span>
              Bytes <span className="text-zinc-300">{stats.bytes_received.toLocaleString()}</span>
            </span>
            <span>
              RX <span className="text-zinc-300">{stats.frames_received.toLocaleString()}</span>
            </span>
            <span>
              Invalid <span className={stats.frames_invalid > 0 ? "text-amber-400" : "text-zinc-300"}>{stats.frames_invalid}</span>
            </span>
            <span>
              Lost <span className={stats.frames_lost > 0 ? "text-red-400" : "text-zinc-300"}>{stats.frames_lost}</span>
            </span>
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

