import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMotorStore } from "../../stores/motor-store";
import type { MotorMode } from "../../types/motor";

const MODE_LABELS: Record<MotorMode, string> = {
  0: "MIT Control",
  1: "Position (CSP)",
  2: "Speed",
};

export function MotorControlPanel() {
  const connected = useMotorStore((s) => s.connected);
  const [mode, setMode] = useState<MotorMode>(0);
  const [error, setError] = useState("");
  const [protocol, setProtocol] = useState<"mit" | "private">("private");

  // MIT params
  const [position, setPosition] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [kp, setKp] = useState(0);
  const [kd, setKd] = useState(0.5);
  const [torque, setTorque] = useState(0);

  // Position mode
  const [targetPos, setTargetPos] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(2);

  // Speed mode
  const [targetSpeed, setTargetSpeed] = useState(0);
  const [currentLimit, setCurrentLimit] = useState(2);

  const call = async (fn: string, args?: Record<string, unknown>) => {
    setError("");
    try {
      await invoke(fn, args);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSetMode = async (m: MotorMode) => {
    await call("motor_set_mode", { mode: m });
    setMode(m);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-xs">
      {/* Protocol selector */}
      <div className="flex mb-2 rounded bg-zinc-800 p-0.5">
        <button
          className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
            protocol === "private"
              ? "bg-amber-600 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
          onClick={() => setProtocol("private")}
        >
          Private (Default)
        </button>
        <button
          className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
            protocol === "mit"
              ? "bg-blue-600 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
          onClick={() => setProtocol("mit")}
        >
          MIT
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5 mb-3">
        <button
          className="flex-1 py-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-medium disabled:opacity-40"
          disabled={!connected}
          onClick={() =>
            protocol === "private"
              ? call("priv_enable")
              : call("motor_enable")
          }
        >
          Enable
        </button>
        <button
          className="flex-1 py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium disabled:opacity-40"
          disabled={!connected}
          onClick={() =>
            protocol === "private"
              ? call("priv_stop", { clearFault: false })
              : call("motor_stop")
          }
        >
          Stop
        </button>
        <button
          className="flex-1 py-1.5 rounded bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50 font-medium disabled:opacity-40"
          disabled={!connected}
          onClick={() =>
            protocol === "private"
              ? call("priv_set_zero")
              : call("motor_set_zero")
          }
        >
          Set Zero
        </button>
      </div>

      {/* Fault buttons */}
      <div className="flex gap-1.5 mb-3">
        <button
          className="flex-1 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-40"
          disabled={!connected}
          onClick={() =>
            protocol === "private"
              ? call("priv_stop", { clearFault: true })
              : call("motor_clear_fault")
          }
        >
          Clear Fault
        </button>
        <button
          className="flex-1 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-40"
          disabled={!connected}
          onClick={() =>
            protocol === "private"
              ? call("priv_fault_feedback")
              : call("motor_read_fault")
          }
        >
          Read Fault
        </button>
      </div>

      {/* Mode selector (MIT only) */}
      {protocol === "mit" && (
        <div className="flex mb-3 rounded bg-zinc-800 p-0.5">
          {([0, 1, 2] as MotorMode[]).map((m) => (
            <button
              key={m}
              className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                mode === m
                  ? "bg-zinc-600 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              disabled={!connected}
              onClick={() => handleSetMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      )}

      {/* MIT mode-specific controls */}
      {protocol === "mit" && mode === 0 && (
        <div className="space-y-2">
          <ParamSlider label="Position" unit="rad" value={position} onChange={setPosition} min={-12.57} max={12.57} step={0.01} />
          <ParamSlider label="Velocity" unit="rad/s" value={velocity} onChange={setVelocity} min={-33} max={33} step={0.1} />
          <ParamSlider label="Kp" unit="" value={kp} onChange={setKp} min={0} max={500} step={0.5} />
          <ParamSlider label="Kd" unit="" value={kd} onChange={setKd} min={0} max={5} step={0.01} />
          <ParamSlider label="Torque" unit="N.m" value={torque} onChange={setTorque} min={-14} max={14} step={0.01} />
          <button
            className="w-full py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-medium disabled:opacity-40 mt-2"
            disabled={!connected}
            onClick={() =>
              call("motor_mit_control", { position, velocity, kp, kd, torque })
            }
          >
            Send MIT Command
          </button>
        </div>
      )}

      {protocol === "mit" && mode === 1 && (
        <div className="space-y-2">
          <ParamSlider label="Target Pos" unit="rad" value={targetPos} onChange={setTargetPos} min={-12.57} max={12.57} step={0.01} />
          <ParamSlider label="Max Speed" unit="rad/s" value={maxSpeed} onChange={setMaxSpeed} min={0} max={33} step={0.1} />
          <button
            className="w-full py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-medium disabled:opacity-40 mt-2"
            disabled={!connected}
            onClick={() =>
              call("motor_position_control", {
                targetPosition: targetPos,
                maxSpeed,
              })
            }
          >
            Send Position Command
          </button>
        </div>
      )}

      {protocol === "mit" && mode === 2 && (
        <div className="space-y-2">
          <ParamSlider label="Speed" unit="rad/s" value={targetSpeed} onChange={setTargetSpeed} min={-33} max={33} step={0.1} />
          <ParamSlider label="Current Limit" unit="A" value={currentLimit} onChange={setCurrentLimit} min={0} max={15.5} step={0.1} />
          <button
            className="w-full py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-medium disabled:opacity-40 mt-2"
            disabled={!connected}
            onClick={() =>
              call("motor_speed_control", { targetSpeed, currentLimit })
            }
          >
            Send Speed Command
          </button>
        </div>
      )}

      {/* Private protocol hint */}
      {protocol === "private" && (
        <div className="text-[10px] text-zinc-500 bg-zinc-800/50 rounded p-2 mt-1">
          <p className="text-amber-400 font-medium mb-1">Private Protocol Mode (Extended Frame)</p>
          <p>RS00 defaults to this mode. Enable/Stop/SetZero use extended CAN frames.</p>
          <p className="mt-1">For MIT control, switch to MIT tab above. Motor must be in MIT mode first (see Params/Config → Protocol Switch).</p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <p className="mt-2 text-red-400 text-[10px] break-all">{error}</p>
      )}
    </div>
  );
}

// ── Reusable parameter slider ───────────────────────────────────────

function ParamSlider({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-zinc-400">
          {label} {unit && <span className="text-zinc-600">({unit})</span>}
        </span>
        <input
          type="number"
          className="w-20 px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-right text-[10px] focus:outline-none focus:border-zinc-500"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
        />
      </div>
      <input
        type="range"
        className="w-full h-1 accent-blue-500"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}
