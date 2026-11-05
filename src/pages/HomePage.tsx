import { Link } from "react-router-dom";
import {
  FiCpu,
  FiSettings,
  FiCamera,
  FiActivity,
  FiWifi,
  FiTool,
  FiRadio,
} from "react-icons/fi";
import { useI18n } from "../i18n";
import type { I18nKeys } from "../i18n/zh";

interface ToolCard {
  titleKey: I18nKeys;
  descriptionKey: I18nKeys;
  icon: React.ReactNode;
  path: string;
  status: "ready" | "dev" | "planned";
}

const tools: ToolCard[] = [
  {
    titleKey: "home.tool.imu.title",
    descriptionKey: "home.tool.imu.desc",
    icon: <FiCpu className="w-7 h-7" />,
    path: "/imu-debug",
    status: "ready",
  },
  {
    titleKey: "home.tool.motor.title",
    descriptionKey: "home.tool.motor.desc",
    icon: <FiSettings className="w-7 h-7" />,
    path: "/motor-debug",
    status: "ready",
  },
  {
    titleKey: "home.tool.remote.title",
    descriptionKey: "home.tool.remote.desc",
    icon: <FiRadio className="w-7 h-7" />,
    path: "/remote-debug",
    status: "ready",
  },
  {
    titleKey: "home.tool.camera.title",
    descriptionKey: "home.tool.camera.desc",
    icon: <FiCamera className="w-7 h-7" />,
    path: "/camera-calibration",
    status: "planned",
  },
  {
    titleKey: "home.tool.sensor.title",
    descriptionKey: "home.tool.sensor.desc",
    icon: <FiActivity className="w-7 h-7" />,
    path: "/sensor-monitor",
    status: "planned",
  },
  {
    titleKey: "home.tool.network.title",
    descriptionKey: "home.tool.network.desc",
    icon: <FiWifi className="w-7 h-7" />,
    path: "/network-tools",
    status: "planned",
  },
  {
    titleKey: "home.tool.device.title",
    descriptionKey: "home.tool.device.desc",
    icon: <FiTool className="w-7 h-7" />,
    path: "/device-manager",
    status: "planned",
  },
];

const statusKey: Record<ToolCard["status"], I18nKeys> = {
  ready: "common.status.ready",
  dev: "common.status.inDev",
  planned: "common.status.planned",
};

const statusClass: Record<ToolCard["status"], { cls: string }> = {
  ready: { cls: "bg-emerald-500/20 text-emerald-400" },
  dev: { cls: "bg-amber-500/20 text-amber-400" },
  planned: { cls: "bg-zinc-500/20 text-zinc-400" },
};

export function HomePage() {
  const { t } = useI18n();

  return (
    <div className="flex-1 overflow-auto p-8">
      {/* Hero */}
      <div className="max-w-5xl mx-auto mb-10">
        <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
          {t("home.title")}
        </h1>
        <p className="mt-2 text-zinc-400 text-sm">
          {t("home.subtitle")}
        </p>
      </div>

      {/* Tool grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const badge = statusClass[tool.status];
          const isClickable = tool.status === "ready";

          const card = (
            <div
              className={`group relative rounded-xl border p-5 h-full flex flex-col transition-all ${
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
                  {t(statusKey[tool.status])}
                </span>
              </div>

              {/* Body */}
              <h2 className="text-sm font-semibold text-zinc-100 mb-1">
                {t(tool.titleKey)}
              </h2>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {t(tool.descriptionKey)}
              </p>
            </div>
          );

          return isClickable ? (
            <Link key={tool.path} to={tool.path} className="no-underline h-full">
              {card}
            </Link>
          ) : (
            <div key={tool.path} className="h-full">{card}</div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="max-w-5xl mx-auto mt-10 text-center text-xs text-zinc-600">
        {t("home.footer")}
      </div>
    </div>
  );
}
