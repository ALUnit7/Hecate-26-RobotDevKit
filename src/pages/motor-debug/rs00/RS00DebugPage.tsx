import { useState } from "react";
import { useMotorData } from "../../../hooks/use-motor-data";
import { MotorToolbar } from "../../../components/motor/MotorToolbar";
import { MotorControlPanel } from "../../../components/motor/MotorControlPanel";
import { MotorParamsPanel } from "../../../components/motor/MotorParamsPanel";
import { MotorDashboard } from "../../../components/motor/MotorDashboard";
import { MotorChart } from "../../../components/motor/MotorChart";
import { CanFrameLog } from "../../../components/motor/CanFrameLog";

export function RS00DebugPage() {
  useMotorData();
  const [rightPanel, setRightPanel] = useState<"control" | "params">("control");

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Connection toolbar */}
      <MotorToolbar />

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Chart (60%) */}
        <div className="w-[60%] border-r border-zinc-800">
          <MotorChart />
        </div>

        {/* Right: Panel switcher (40%) */}
        <div className="w-[40%] flex flex-col">
          {/* Panel toggle */}
          <div className="flex border-b border-zinc-800 shrink-0">
            <button
              className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                rightPanel === "control"
                  ? "text-zinc-100 border-b-2 border-blue-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              onClick={() => setRightPanel("control")}
            >
              Control
            </button>
            <button
              className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                rightPanel === "params"
                  ? "text-zinc-100 border-b-2 border-blue-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              onClick={() => setRightPanel("params")}
            >
              Params / Config
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {rightPanel === "control" ? <MotorControlPanel /> : <MotorParamsPanel />}
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <MotorDashboard />

      {/* CAN frame log */}
      <div className="h-[160px] min-h-[100px]">
        <CanFrameLog />
      </div>
    </div>
  );
}
