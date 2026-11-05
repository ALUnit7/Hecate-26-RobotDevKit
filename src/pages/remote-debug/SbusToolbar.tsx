import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FiRadio, FiRefreshCw, FiAlertTriangle } from "react-icons/fi";
import { useSbusStore } from "../../stores/sbus-store";
import type { PortInfo } from "../../types/imu";
import { cn } from "../../lib/utils";
import { useI18n } from "../../i18n";

const BAUD_RATES = [100000, 115200, 200000];

/** Shared serial connection toolbar used by both mapped and raw sub-pages */
export function SbusToolbar() {
  const { t } = useI18n();
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const { connected, baudRate, signalLost, error, setConnected, setBaudRate, setError, reset } =
    useSbusStore();

  const refreshPorts = useCallback(async () => {
    try {
      const result = await invoke<PortInfo[]>("list_ports");
      setPorts(result);
      if (result.length > 0 && !selectedPort) setSelectedPort(result[0].name);
    } catch (e) {
      setError(String(e));
    }
  }, [selectedPort, setError]);

  useEffect(() => { refreshPorts(); }, [refreshPorts]);

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
      <select
        value={selectedPort}
        onChange={(e) => setSelectedPort(e.target.value)}
        disabled={connected}
        className="h-7 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-2 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
      >
        {ports.length === 0 && <option value="">{t("common.noPortsFound")}</option>}
        {ports.map((p) => (
          <option key={p.name} value={p.name}>{p.name} — {p.port_type}</option>
        ))}
      </select>
      <button
        onClick={refreshPorts}
        disabled={connected}
        className="h-7 w-7 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 flex items-center justify-center"
        title={t("common.refreshPorts")}
      >
        <FiRefreshCw className="w-3 h-3" />
      </button>
      <select
        value={baudRate}
        onChange={(e) => setBaudRate(Number(e.target.value))}
        disabled={connected}
        className="h-7 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-2 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
      >
        {BAUD_RATES.map((b) => (
          <option key={b} value={b}>{b.toLocaleString()} baud</option>
        ))}
      </select>
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
        {connected ? t("common.disconnect") : t("common.connect")}
      </button>
      <div className="ml-auto flex items-center gap-3">
        {signalLost && connected && (
          <span className="flex items-center gap-1 text-amber-400 text-[10px]">
            <FiAlertTriangle className="w-3 h-3" />
            {t("toolbar.status.signalLost")}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full",
            connected && !signalLost ? "bg-emerald-500" : connected ? "bg-amber-500" : "bg-zinc-600"
          )} />
          <span className="text-zinc-400 text-[10px]">
            {!connected
              ? t("common.disconnected")
              : signalLost
              ? t("toolbar.status.noSignal")
              : t("toolbar.status.receiving")}
          </span>
        </div>
      </div>
      {error && <span className="w-full text-red-400 text-[10px] mt-0.5">{error}</span>}
    </div>
  );
}
