import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { PortInfo } from "../../types/imu";
import { useImuStore } from "../../stores/imu-store";
import { cn } from "../../lib/utils";

const BAUD_RATES = [4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

export function ConnectionToolbar() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [error, setError] = useState("");

  const connected = useImuStore((s) => s.connected);
  const setConnected = useImuStore((s) => s.setConnected);
  const baudRate = useImuStore((s) => s.baudRate);
  const setBaudRate = useImuStore((s) => s.setBaudRate);
  const fps = useImuStore((s) => s.fps);
  const reset = useImuStore((s) => s.reset);

  const refreshPorts = useCallback(async () => {
    try {
      const result = await invoke<PortInfo[]>("list_ports");
      setPorts(result);
      if (result.length > 0 && !selectedPort) {
        const cp210x = result.find((p) => p.port_type.includes("10C4"));
        setSelectedPort(cp210x ? cp210x.name : result[0].name);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [selectedPort]);

  useEffect(() => {
    refreshPorts();
    const unlisten = listen<string>("serial-error", (event) => {
      setError(event.payload);
      setConnected(false);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [refreshPorts, setConnected]);

  const handleConnect = async () => {
    if (connected) {
      try {
        await invoke("close_port");
        setConnected(false);
        reset();
      } catch (e) {
        setError(String(e));
      }
    } else {
      try {
        setError("");
        await invoke("open_port", {
          portName: selectedPort,
          baudRate: baudRate,
        });
        setConnected(true);
      } catch (e) {
        setError(String(e));
      }
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/80">
      {/* Port selector */}
      <div className="flex items-center gap-1">
        <select
          value={selectedPort}
          onChange={(e) => setSelectedPort(e.target.value)}
          disabled={connected}
          className="h-8 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        >
          {ports.length === 0 && <option value="">No ports found</option>}
          {ports.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} - {p.port_type}
            </option>
          ))}
        </select>
        <button
          onClick={refreshPorts}
          disabled={connected}
          className="h-8 w-8 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 text-sm flex items-center justify-center"
          title="Refresh ports"
        >
          &#x21bb;
        </button>
      </div>

      {/* Baud rate */}
      <select
        value={baudRate}
        onChange={(e) => setBaudRate(Number(e.target.value))}
        disabled={connected}
        className="h-8 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      >
        {BAUD_RATES.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      {/* Connect button */}
      <button
        onClick={handleConnect}
        className={cn(
          "h-8 px-4 rounded-md text-sm font-medium transition-colors",
          connected
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        )}
      >
        {connected ? "Disconnect" : "Connect"}
      </button>

      {/* Status */}
      <div className="flex items-center gap-2 ml-auto text-sm">
        {error && (
          <span className="text-red-400 max-w-[300px] truncate" title={error}>
            {error}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              connected ? "bg-green-500" : "bg-zinc-600"
            )}
          />
          <span className="text-zinc-400">
            {connected ? `Connected · ${fps} fps` : "Disconnected"}
          </span>
        </div>
      </div>
    </div>
  );
}
