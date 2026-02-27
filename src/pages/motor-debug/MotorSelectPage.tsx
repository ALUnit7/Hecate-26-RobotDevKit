import { Link } from "react-router-dom";
import { FiCpu, FiArrowRight } from "react-icons/fi";

interface MotorOption {
  name: string;
  description: string;
  protocol: string;
  path: string;
  status: "ready" | "planned";
}

const motors: MotorOption[] = [
  {
    name: "RobStride RS00",
    description:
      "Quasi-direct-drive integrated motor module. 5 N.m rated, 14 N.m peak. 10:1 reducer, 14-bit encoder. MIT / Position / Speed modes via CAN.",
    protocol: "MIT Protocol (CAN 2.0 Standard Frame)",
    path: "/motor-debug/rs00",
    status: "ready",
  },
  {
    name: "DJI 3508 / 6020",
    description:
      "RoboMaster series motors with C620/C610 ESC. Current/voltage control via CAN.",
    protocol: "DJI CAN Protocol",
    path: "/motor-debug/dji",
    status: "planned",
  },
];

const statusBadge = {
  ready: { text: "Ready", cls: "bg-emerald-500/20 text-emerald-400" },
  planned: { text: "Planned", cls: "bg-zinc-500/20 text-zinc-400" },
};

export function MotorSelectPage() {
  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-3xl mx-auto mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Motor Debugger</h1>
        <p className="mt-1 text-zinc-400 text-sm">
          Select a motor type to begin debugging.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {motors.map((m) => {
          const badge = statusBadge[m.status];
          const isClickable = m.status === "ready";

          const card = (
            <div
              className={`group flex items-center justify-between rounded-xl border p-5 transition-all ${
                isClickable
                  ? "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/80 cursor-pointer"
                  : "border-zinc-800 bg-zinc-900/50 opacity-60 cursor-default"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5 text-zinc-400">
                  <FiCpu className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-semibold text-zinc-100">
                      {m.name}
                    </h2>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}
                    >
                      {badge.text}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-1">
                    {m.description}
                  </p>
                  <p className="text-[10px] text-zinc-600">{m.protocol}</p>
                </div>
              </div>
              {isClickable && (
                <FiArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0 ml-4" />
              )}
            </div>
          );

          return isClickable ? (
            <Link key={m.path} to={m.path} className="no-underline block">
              {card}
            </Link>
          ) : (
            <div key={m.path}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
