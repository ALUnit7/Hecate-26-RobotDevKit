import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMotorStore } from "../../stores/motor-store";
import type { ParamDef } from "../../types/motor";

export function MotorParamsPanel() {
  const connected = useMotorStore((s) => s.connected);
  const config = useMotorStore((s) => s.config);
  const paramTable = useMotorStore((s) => s.paramTable);
  const setParamTable = useMotorStore((s) => s.setParamTable);
  const paramValues = useMotorStore((s) => s.paramValues);
  const clearParamValues = useMotorStore((s) => s.clearParamValues);
  const faultStatus = useMotorStore((s) => s.faultStatus);
  const deviceId = useMotorStore((s) => s.deviceId);
  const deviceMotorId = useMotorStore((s) => s.deviceMotorId);
  const firmwareVersion = useMotorStore((s) => s.firmwareVersion);
  const privateFeedback = useMotorStore((s) => s.privateFeedback);

  const [activeTab, setActiveTab] = useState<"params" | "config" | "faults">("params");
  const [editValues, setEditValues] = useState<Record<number, string>>({});
  const [readingAll, setReadingAll] = useState(false);

  // Load param table on mount
  useEffect(() => {
    invoke<ParamDef[]>("get_param_table").then(setParamTable).catch(console.error);
  }, [setParamTable]);

  const writableParams = paramTable.filter((p) => p.access === "RW");
  const readonlyParams = paramTable.filter((p) => p.access === "R");

  const readParam = useCallback(async (index: number) => {
    if (!connected) return;
    try {
      await invoke("priv_param_read", { index });
    } catch (e) {
      console.error("param read failed:", e);
    }
  }, [connected]);

  const readAllParams = useCallback(async () => {
    if (!connected) return;
    setReadingAll(true);
    clearParamValues();
    for (const p of paramTable) {
      try {
        await invoke("priv_param_read", { index: p.index });
        await new Promise((r) => setTimeout(r, 20)); // Small delay between reads
      } catch (e) {
        console.error("param read failed:", p.name, e);
      }
    }
    setReadingAll(false);
  }, [connected, paramTable, clearParamValues]);

  const writeParam = useCallback(async (p: ParamDef) => {
    const strVal = editValues[p.index];
    if (strVal === undefined || strVal === "") return;
    const val = parseFloat(strVal);
    if (isNaN(val)) return;

    const typeMap: Record<string, string> = {
      U8: "u8", U16: "u16", U32: "u32", I16: "i16", F32: "f32",
    };
    const paramType = typeMap[p.paramType] || "f32";

    try {
      await invoke("priv_param_write", { index: p.index, paramType, valueF64: val });
      // Read back to confirm
      await new Promise((r) => setTimeout(r, 20));
      await invoke("priv_param_read", { index: p.index });
    } catch (e) {
      console.error("param write failed:", p.name, e);
    }
  }, [editValues]);

  const saveToFlash = useCallback(async () => {
    if (!connected) return;
    try {
      await invoke("priv_save_params");
    } catch (e) {
      console.error("save params failed:", e);
    }
  }, [connected]);

  const formatValue = (p: ParamDef, index: number) => {
    const v = paramValues[index];
    if (!v) return "—";
    if (!v.success) return "ERR";
    if (p.paramType === "F32") return v.value_f32.toFixed(4);
    if (p.paramType === "I16") {
      const i16 = v.value_u32 > 32767 ? v.value_u32 - 65536 : v.value_u32;
      return i16.toString();
    }
    return v.value_u32.toString();
  };

  const valueColor = (index: number, defaultColor: string) => {
    const v = paramValues[index];
    if (v && !v.success) return "text-red-400";
    return defaultColor;
  };

  // Config tab state
  const [protocolVal, setProtocolVal] = useState("2"); // MIT
  const [baudVal, setBaudVal] = useState("1"); // 1M
  const [reportEnabled, setReportEnabled] = useState(false);
  const [newCanId, setNewCanId] = useState("");
  const [canIdStatus, setCanIdStatus] = useState("");

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800 shrink-0">
        {(["params", "config", "faults"] as const).map((tab) => (
          <button
            key={tab}
            className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === tab
                ? "text-zinc-100 border-b-2 border-blue-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "params" ? "Parameters" : tab === "config" ? "Config" : "Faults"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "params" && (
          <div className="p-2">
            {/* Toolbar */}
            <div className="flex gap-2 mb-2">
              <button
                className="px-2 py-1 text-[10px] bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-40"
                disabled={!connected || readingAll}
                onClick={readAllParams}
              >
                {readingAll ? "Reading..." : "Read All"}
              </button>
              <button
                className="px-2 py-1 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded disabled:opacity-40"
                disabled={!connected}
                onClick={saveToFlash}
              >
                Save to Flash
              </button>
            </div>

            {/* Writable params */}
            <div className="text-[10px] text-zinc-500 font-medium mb-1">Writable Parameters</div>
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-0.5 px-1 w-16">Index</th>
                  <th className="text-left py-0.5 px-1">Name</th>
                  <th className="text-right py-0.5 px-1 w-20">Value</th>
                  <th className="text-left py-0.5 px-1 w-20">Set</th>
                  <th className="py-0.5 px-1 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {writableParams.map((p) => (
                  <tr key={p.index} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-0.5 px-1 text-zinc-600">0x{p.index.toString(16).toUpperCase()}</td>
                    <td className="py-0.5 px-1 text-zinc-300" title={p.desc}>{p.name}</td>
                    <td className={`py-0.5 px-1 text-right ${valueColor(p.index, "text-blue-400")}`}>{formatValue(p, p.index)}</td>
                    <td className="py-0.5 px-1">
                      <input
                        type="text"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-1 py-0 text-[10px] text-zinc-200 focus:border-blue-500 focus:outline-none"
                        placeholder={p.defaultStr}
                        value={editValues[p.index] ?? ""}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [p.index]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") writeParam(p);
                        }}
                      />
                    </td>
                    <td className="py-0.5 px-1 text-center">
                      <button
                        className="text-[9px] text-blue-400 hover:text-blue-300 disabled:opacity-40"
                        disabled={!connected}
                        onClick={() => writeParam(p)}
                        title="Write"
                      >
                        W
                      </button>
                      <button
                        className="ml-1 text-[9px] text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                        disabled={!connected}
                        onClick={() => readParam(p.index)}
                        title="Read"
                      >
                        R
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Read-only params (requires firmware >= 0.0.3.5) */}
            {readonlyParams.length > 0 && (
              <>
                <div className="text-[10px] text-zinc-500 font-medium mt-3 mb-1">
                  Read-Only Parameters
                  <span className="text-zinc-600 font-normal ml-1">(firmware &ge; 0.0.3.5)</span>
                </div>
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-0.5 px-1 w-16">Index</th>
                      <th className="text-left py-0.5 px-1">Name</th>
                      <th className="text-right py-0.5 px-1 w-24">Value</th>
                      <th className="py-0.5 px-1 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {readonlyParams.map((p) => (
                      <tr key={p.index} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="py-0.5 px-1 text-zinc-600">0x{p.index.toString(16).toUpperCase()}</td>
                        <td className="py-0.5 px-1 text-zinc-300" title={p.desc}>{p.name}</td>
                        <td className={`py-0.5 px-1 text-right ${valueColor(p.index, "text-emerald-400")}`}>{formatValue(p, p.index)}</td>
                        <td className="py-0.5 px-1 text-center">
                          <button
                            className="text-[9px] text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                            disabled={!connected}
                            onClick={() => readParam(p.index)}
                          >
                            R
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Realtime Feedback (from type 2 / type 24 frames) */}
            <div className="text-[10px] text-zinc-500 font-medium mt-3 mb-1">
              Realtime Feedback
              <span className="text-zinc-600 font-normal ml-1">(from type 2 response frames)</span>
            </div>
            {privateFeedback ? (
              <table className="w-full text-[10px] font-mono">
                <tbody>
                  {[
                    { label: "Angle", value: `${privateFeedback.angle.toFixed(4)} rad`, color: "text-emerald-400" },
                    { label: "Velocity", value: `${privateFeedback.velocity.toFixed(4)} rad/s`, color: "text-emerald-400" },
                    { label: "Torque", value: `${privateFeedback.torque.toFixed(4)} N.m`, color: "text-emerald-400" },
                    { label: "Temperature", value: `${privateFeedback.temperature.toFixed(1)} °C`, color: "text-emerald-400" },
                    { label: "Mode", value: ["Reset", "Calibration", "Motor"][privateFeedback.mode_status] ?? `Unknown(${privateFeedback.mode_status})`, color: "text-blue-400" },
                    { label: "Fault Bits", value: privateFeedback.fault_bits === 0 ? "None" : `0x${privateFeedback.fault_bits.toString(16).toUpperCase()}`, color: privateFeedback.fault_bits === 0 ? "text-emerald-400" : "text-red-400" },
                    { label: "Motor ID", value: privateFeedback.motor_id.toString(), color: "text-zinc-300" },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-zinc-800/50">
                      <td className="py-0.5 px-1 text-zinc-500 w-24">{row.label}</td>
                      <td className={`py-0.5 px-1 ${row.color}`}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-[10px] text-zinc-600 bg-zinc-800/50 rounded p-2">
                No feedback yet. Enable the motor or start active reporting (Config tab) to receive type 2 frames.
              </div>
            )}
          </div>
        )}

        {activeTab === "config" && (
          <div className="p-3 space-y-4">
            {/* Protocol Switch */}
            <div>
              <div className="text-[11px] text-zinc-400 font-medium mb-2">Protocol Switch</div>
              <p className="text-[10px] text-zinc-600 mb-2">
                Changes require power cycle to take effect.
              </p>
              <div className="flex gap-2 items-center">
                <select
                  className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                  value={protocolVal}
                  onChange={(e) => setProtocolVal(e.target.value)}
                >
                  <option value="0">Private Protocol</option>
                  <option value="1">CANopen</option>
                  <option value="2">MIT Protocol</option>
                </select>
                <button
                  className="px-2 py-1 text-[10px] bg-orange-600 hover:bg-orange-500 text-white rounded disabled:opacity-40"
                  disabled={!connected}
                  onClick={async () => {
                    try {
                      await invoke("priv_change_protocol", { protocol: parseInt(protocolVal) });
                    } catch (e) { console.error(e); }
                  }}
                >
                  Switch (Private)
                </button>
                <button
                  className="px-2 py-1 text-[10px] bg-orange-600 hover:bg-orange-500 text-white rounded disabled:opacity-40"
                  disabled={!connected}
                  onClick={async () => {
                    try {
                      await invoke("motor_change_protocol", { protocol: parseInt(protocolVal) });
                    } catch (e) { console.error(e); }
                  }}
                >
                  Switch (MIT Cmd8)
                </button>
              </div>
            </div>

            {/* Baud Rate */}
            <div>
              <div className="text-[11px] text-zinc-400 font-medium mb-2">Baud Rate</div>
              <p className="text-[10px] text-zinc-600 mb-2">
                Requires power cycle. Default 1Mbps.
              </p>
              <div className="flex gap-2 items-center">
                <select
                  className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                  value={baudVal}
                  onChange={(e) => setBaudVal(e.target.value)}
                >
                  <option value="1">1 Mbps</option>
                  <option value="2">500 Kbps</option>
                  <option value="3">250 Kbps</option>
                  <option value="4">125 Kbps</option>
                </select>
                <button
                  className="px-2 py-1 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded disabled:opacity-40"
                  disabled={!connected}
                  onClick={async () => {
                    try {
                      await invoke("priv_change_baud", { baudCode: parseInt(baudVal) });
                    } catch (e) { console.error(e); }
                  }}
                >
                  Set Baud Rate
                </button>
              </div>
            </div>

            {/* Active Report */}
            <div>
              <div className="text-[11px] text-zinc-400 font-medium mb-2">Active Reporting</div>
              <p className="text-[10px] text-zinc-600 mb-2">
                Motor sends feedback periodically without control commands.
              </p>
              <div className="flex gap-2 items-center">
                <button
                  className={`px-3 py-1 text-[10px] rounded disabled:opacity-40 ${
                    reportEnabled
                      ? "bg-red-600 hover:bg-red-500 text-white"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                  disabled={!connected}
                  onClick={async () => {
                    try {
                      const enable = reportEnabled ? 0 : 1;
                      await invoke("priv_active_report", { enable });
                      setReportEnabled(!reportEnabled);
                    } catch (e) { console.error(e); }
                  }}
                >
                  {reportEnabled ? "Stop Report" : "Start Report"}
                </button>
              </div>
            </div>

            {/* Device Info */}
            <div>
              <div className="text-[11px] text-zinc-400 font-medium mb-2">Device Info</div>
              <div className="flex gap-2 mb-2">
                <button
                  className="px-2 py-1 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded disabled:opacity-40"
                  disabled={!connected}
                  onClick={async () => {
                    try { await invoke("priv_get_device_id"); } catch (e) { console.error(e); }
                  }}
                >
                  Get Device ID
                </button>
                <button
                  className="px-2 py-1 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded disabled:opacity-40"
                  disabled={!connected}
                  onClick={async () => {
                    try { await invoke("priv_read_version"); } catch (e) { console.error(e); }
                  }}
                >
                  Read Version
                </button>
              </div>
              {(deviceId || firmwareVersion) && (
                <div className="bg-zinc-800/50 rounded p-2 text-[10px] font-mono space-y-0.5">
                  {deviceId && (
                    <div className="text-zinc-300">
                      <span className="text-zinc-500">MCU ID: </span>
                      {deviceId}
                      {deviceMotorId !== null && (
                        <span className="text-zinc-500 ml-2">(Motor CAN ID: {deviceMotorId})</span>
                      )}
                    </div>
                  )}
                  {firmwareVersion && (
                    <div className="text-zinc-300">
                      <span className="text-zinc-500">Version: </span>
                      {firmwareVersion}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Set CAN ID */}
            <div>
              <div className="text-[11px] text-zinc-400 font-medium mb-2">Set Motor CAN ID</div>
              <p className="text-[10px] text-zinc-600 mb-2">
                Change the motor's CAN ID via private protocol type 7, auto-saves to flash.
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  className="w-16 px-2 py-1 text-[11px] bg-zinc-800 border border-zinc-700 text-zinc-200 rounded focus:border-blue-500 focus:outline-none"
                  min={0}
                  max={127}
                  placeholder="0~127"
                  value={newCanId}
                  onChange={(e) => setNewCanId(e.target.value)}
                />
                <button
                  className="px-2 py-1 text-[10px] bg-orange-600 hover:bg-orange-500 text-white rounded disabled:opacity-40"
                  disabled={!connected || !newCanId}
                  onClick={async () => {
                    const id = parseInt(newCanId);
                    if (isNaN(id) || id < 0 || id > 127) return;
                    setCanIdStatus("");
                    try {
                      await invoke("priv_set_can_id", { newId: id });
                      setCanIdStatus("Set CAN ID sent. Saving to flash...");
                      await new Promise((r) => setTimeout(r, 50));
                      await invoke("priv_save_params");
                      // Sync backend config to the new motor ID
                      await invoke("udp_update_motor_ids", { motorId: id, masterId: config.master_id }).catch(() => {});
                      setCanIdStatus(`CAN ID → ${id} saved. Motor ID updated. Power cycle the motor to apply.`);
                    } catch (e) {
                      setCanIdStatus(`Error: ${e}`);
                    }
                  }}
                >
                  Set CAN ID
                </button>
              </div>
              {canIdStatus && (
                <p className={`text-[10px] mt-1.5 ${canIdStatus.startsWith("Error") ? "text-red-400" : "text-amber-400"}`}>
                  {canIdStatus}
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "faults" && (
          <div className="p-3">
            <div className="flex gap-2 mb-3">
              <button
                className="px-2 py-1 text-[10px] bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-40"
                disabled={!connected}
                onClick={async () => {
                  try { await invoke("motor_read_fault"); } catch (e) { console.error(e); }
                }}
              >
                Read Faults (MIT)
              </button>
              <button
                className="px-2 py-1 text-[10px] bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-40"
                disabled={!connected}
                onClick={async () => {
                  try { await invoke("priv_fault_feedback"); } catch (e) { console.error(e); }
                }}
              >
                Read Faults (Private)
              </button>
              <button
                className="px-2 py-1 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded disabled:opacity-40"
                disabled={!connected}
                onClick={async () => {
                  try { await invoke("motor_clear_fault"); } catch (e) { console.error(e); }
                }}
              >
                Clear Faults
              </button>
            </div>

            {faultStatus ? (
              <div>
                <div className="text-[11px] text-zinc-400 mb-1">
                  Raw: 0x{faultStatus.raw.toString(16).toUpperCase().padStart(8, "0")}
                </div>
                {faultStatus.faults.length === 0 ? (
                  <div className="text-[11px] text-emerald-400 py-2">No faults detected</div>
                ) : (
                  <div className="space-y-1">
                    {faultStatus.faults.map((f, i) => (
                      <div key={i} className="text-[11px] text-red-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-zinc-600 py-4 text-center">
                No fault data. Click "Read Faults" to check.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
