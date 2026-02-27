import { Link } from "react-router-dom";
import {
  FiCpu,
  FiSettings,
  FiCamera,
  FiActivity,
  FiWifi,
  FiTool,
} from "react-icons/fi";

interface ToolCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  status: "ready" | "dev" | "planned";
}

const tools: ToolCard[] = [
  {
    title: "IMU Debugger",
    description:
      "Real-time IMU data visualization with charts, 3D attitude display, and AT command console. Supports HiPNUC HI12 series via serial port.",
    icon: <FiCpu className="w-7 h-7" />,
    path: "/imu-debug",
    status: "ready",
  },
  {
    title: "Motor Controller",
    description:
      "Motor debugging via CAN-ETH gateway. Supports RS00 (RobStride) MIT protocol with real-time feedback, charts, and CAN frame logging.",
    icon: <FiSettings className="w-7 h-7" />,
    path: "/motor-debug",
    status: "ready",
  },
  {
    title: "Camera Calibration",
    description:
      "Intrinsic and extrinsic camera calibration, distortion correction, stereo calibration tools.",
    icon: <FiCamera className="w-7 h-7" />,
    path: "/camera-calibration",
    status: "planned",
  },
  {
    title: "Sensor Monitor",
    description:
      "Generic sensor data monitoring dashboard. Supports multiple data sources and custom layouts.",
    icon: <FiActivity className="w-7 h-7" />,
    path: "/sensor-monitor",
    status: "planned",
  },
  {
    title: "Network Tools",
    description:
      "UDP/TCP send & receive, ROS topic inspector, network diagnostics for robot communication.",
    icon: <FiWifi className="w-7 h-7" />,
    path: "/network-tools",
    status: "planned",
  },
  {
    title: "Device Manager",
    description:
      "Serial port, USB device, and network interface enumeration. Firmware update utilities.",
    icon: <FiTool className="w-7 h-7" />,
    path: "/device-manager",
    status: "planned",
  },
];

const statusLabel: Record<ToolCard["status"], { text: string; cls: string }> = {
  ready: { text: "Ready", cls: "bg-emerald-500/20 text-emerald-400" },
  dev: { text: "In Dev", cls: "bg-amber-500/20 text-amber-400" },
  planned: { text: "Planned", cls: "bg-zinc-500/20 text-zinc-400" },
};

export function HomePage() {
  return (
    <div className="flex-1 overflow-auto p-8">
      {/* Hero */}
      <div className="max-w-5xl mx-auto mb-10">
        <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
          Hecate-26 RobotDevKit
        </h1>
        <p className="mt-2 text-zinc-400 text-sm">
          Robot development & debugging toolkit. Select a tool to get started.
        </p>
      </div>

      {/* Tool grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const badge = statusLabel[tool.status];
          const isClickable = tool.status === "ready";

          const card = (
            <div
              className={`group relative rounded-xl border p-5 transition-all ${
                isClickable
                  ? "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/80 cursor-pointer"
                  : "border-zinc-800 bg-zinc-900/50 opacity-60 cursor-default"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-zinc-300">{tool.icon}</div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}
                >
                  {badge.text}
                </span>
              </div>

              {/* Body */}
              <h2 className="text-sm font-semibold text-zinc-100 mb-1">
                {tool.title}
              </h2>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {tool.description}
              </p>
            </div>
          );

          return isClickable ? (
            <Link key={tool.path} to={tool.path} className="no-underline">
              {card}
            </Link>
          ) : (
            <div key={tool.path}>{card}</div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="max-w-5xl mx-auto mt-10 text-center text-xs text-zinc-600">
        H26RDK v0.2.0
      </div>
    </div>
  );
}
