import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useMotorStore } from "../../stores/motor-store";
import { FiWifi, FiWifiOff, FiSettings, FiActivity, FiSearch, FiStopCircle } from "react-icons/fi";
import type { UdpConfig, DiscoveredMotor } from "../../types/motor";

export function MotorToolbar() {
  const { connected, config, setConfig, setConnected, fps,
    discoveredMotors, setDiscoveredMotors, activeMotorId, setActiveMotor, addMotor } = useMotorStore();
  const [showSettings, setShowSettings] = useState(false);
  const [localConfig, setLocalConfig] = useState<UdpConfig>(config);
  const [error, setError] = useState("");
  const [diagResult, setDiagResult] = useState("");
  const [rawHex, setRawHex] = useState("05 00 00 06 78 12 34 56 78 00 00 00 00");
  const [scanning, setScanning] = useState(false);

  const handleConnect = async () => {
    setError("");
    try {
      if (connected) {
        await invoke("udp_disconnect");
        setConnected(false);
      } else {
        setConfig(localConfig);
        await invoke("udp_connect", { config: localConfig });
        setConnected(true);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDiagnose = async () => {
    setDiagResult("");
    setError("");
    try {
      const result = await invoke<string>("udp_diagnose");
      setDiagResult(result);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleScan = async () => {
    setDiagResult("");
    setError("");
    setScanning(true);

    const foundPrivate = new Set<number>();
    const foundMit = new Set<number>();
    const unlistenPriv = await listen<number>("motor-scan-result", (event) => {
      foundPrivate.add(event.payload);
    });
    const unlistenMit = await listen<number>("motor-mit-scan-result", (event) => {
      foundMit.add(event.payload);
    });

    try {
      await invoke("udp_scan_motors");
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      setError(String(e));
    } finally {
      unlistenPriv();
      unlistenMit();
      setScanning(false);

      const discovered: DiscoveredMotor[] = [];
      for (const id of foundPrivate) {
        discovered.push({ id, protocol: "private" });
      }
      for (const id of foundMit) {
        if (!foundPrivate.has(id)) {
          discovered.push({ id, protocol: "mit" });
        }
      }
      discovered.sort((a, b) => a.id - b.id);
      setDiscoveredMotors(discovered);

      // Register each discovered motor in the store
      for (const m of discovered) {
        addMotor(m.id, m.protocol);
      }

      if (discovered.length === 0) {
        setDiagResult("Scan complete: no motors found (0~127). Check CAN baud rate and wiring.");
      } else {
        setDiagResult(
          `Found ${discovered.length} motor(s): ${discovered.map((m) => `ID=${m.id}${m.protocol === "mit" ? " (MIT)" : ""}`).join(", ")}`
        );
        // Auto-select the first motor
        if (discovered.length >= 1) {
          setActiveMotor(discovered[0].id);
          setLocalConfig((c) => ({ ...c, motor_id: discovered[0].id }));
          invoke("udp_update_motor_ids", { motorId: discovered[0].id, masterId: localConfig.master_id }).catch(console.error);
        }
      }
    }
  };

  const handleStopAll = async () => {
    setError("");
    try {
      const ids = discoveredMotors.map((m) => m.id);
      await invoke("motor_stop_all", { motorIds: ids });
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSelectMotor = (id: number) => {
    setActiveMotor(id);
    setLocalConfig((c) => ({ ...c, motor_id: id }));
    invoke("udp_update_motor_ids", { motorId: id, masterId: localConfig.master_id }).catch(console.error);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs shrink-0 flex-wrap">
      {/* Gateway IP */}
      <label className="text-zinc-500">Gateway</label>
      <input
        className="w-32 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
        value={localConfig.gateway_ip}
        onChange={(e) =>
          setLocalConfig((c) => ({ ...c, gateway_ip: e.target.value }))
        }
        disabled={connected}
        placeholder="192.168.0.7"
      />
      <label className="text-zinc-500">Port</label>
      <input
        className="w-16 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
        type="number"
        value={localConfig.gateway_port}
        onChange={(e) =>
          setLocalConfig((c) => ({
            ...c,
            gateway_port: parseInt(e.target.value) || 20001,
          }))
        }
        disabled={connected}
      />

      {/* Master ID */}
      <label className="text-zinc-500 ml-2">Master ID</label>
      <input
        className="w-16 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
        type="number"
        min={0}
        max={127}
        value={localConfig.master_id}
        onChange={(e) => {
          const val = parseInt(e.target.value) || 0;
          setLocalConfig((c) => ({ ...c, master_id: val }));
          if (connected) {
            invoke("udp_update_motor_ids", { motorId: localConfig.motor_id, masterId: val }).catch(console.error);
          }
        }}
      />

      {/* Settings toggle */}
      <button
        className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        onClick={() => setShowSettings(!showSettings)}
        title="Advanced settings"
      >
        <FiSettings className="w-3.5 h-3.5" />
      </button>

      {/* Diagnose & Scan buttons */}
      {connected && (
        <>
          <button
            className="p-1 rounded hover:bg-zinc-700 text-amber-400 hover:text-amber-300 transition-colors"
            onClick={handleDiagnose}
            title="Get Device ID"
          >
            <FiActivity className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1 rounded hover:bg-zinc-700 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-40"
            onClick={handleScan}
            disabled={scanning}
            title="Scan for motors (ID 0~127)"
          >
            <FiSearch className="w-3.5 h-3.5" />
          </button>
          {scanning && (
            <span className="text-[10px] text-blue-400 animate-pulse">Scanning...</span>
          )}
          {discoveredMotors.length > 1 && (
            <button
              className="p-1 rounded hover:bg-zinc-700 text-red-400 hover:text-red-300 transition-colors"
              onClick={handleStopAll}
              title="Stop all motors"
            >
              <FiStopCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      )}

      {/* Connect button */}
      <button
        className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
          connected
            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
        }`}
        onClick={handleConnect}
      >
        {connected ? (
          <FiWifiOff className="w-3 h-3" />
        ) : (
          <FiWifi className="w-3 h-3" />
        )}
        {connected ? "Disconnect" : "Connect"}
      </button>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-emerald-500" : "bg-zinc-600"
          }`}
        />
        {connected && (
          <span className="text-zinc-400">{fps} fps</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <span className="text-red-400 text-[10px] ml-2">{error}</span>
      )}

      {/* Discovered motors chip badges */}
      {discoveredMotors.length > 0 && (
        <div className="w-full flex items-center gap-1.5 mt-1 pt-1 border-t border-zinc-800">
          <span className="text-zinc-500 text-[10px] shrink-0">Motors:</span>
          {discoveredMotors.map((m) => (
            <button
              key={m.id}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                activeMotorId === m.id
                  ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
              onClick={() => handleSelectMotor(m.id)}
            >
              ID={m.id}{m.protocol === "mit" ? " (MIT)" : ""}
            </button>
          ))}
        </div>
      )}

      {/* Diagnostic result */}
      {diagResult && (
        <div className="w-full mt-1 pt-1 border-t border-zinc-800">
          <pre className="text-[10px] text-amber-300 font-mono whitespace-pre-wrap bg-zinc-800/50 rounded p-1.5">
            {diagResult}
          </pre>
          <button
            className="text-[9px] text-zinc-500 hover:text-zinc-300 mt-0.5"
            onClick={() => setDiagResult("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Advanced settings row */}
      {showSettings && (
        <div className="w-full space-y-1.5 pt-1 mt-1 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <label className="text-zinc-500">Local Port</label>
            <input
              className="w-16 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
              type="number"
              value={localConfig.local_port}
              onChange={(e) =>
                setLocalConfig((c) => ({
                  ...c,
                  local_port: parseInt(e.target.value) || 0,
                }))
              }
              disabled={connected}
              placeholder="20001"
            />
            <span className="text-zinc-600 text-[10px]">
              Must match gateway&apos;s work port (default 20001)
            </span>
          </div>
          {connected && (
            <div className="flex items-center gap-2">
              <label className="text-zinc-500 text-[10px]">Raw Frame</label>
              <input
                className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-[10px] font-mono focus:outline-none focus:border-zinc-500"
                value={rawHex}
                onChange={(e) => setRawHex(e.target.value)}
                placeholder="13 hex bytes, e.g. 05 00 00 06 78 12 34 56 78 00 00 00 00"
              />
              <button
                className="px-2 py-1 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded shrink-0"
                onClick={async () => {
                  setError("");
                  setDiagResult("");
                  try {
                    const result = await invoke<string>("udp_send_raw", { hexString: rawHex });
                    setDiagResult(result);
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Send Raw
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
