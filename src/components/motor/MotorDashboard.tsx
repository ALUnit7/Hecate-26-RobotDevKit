import { useMotorStore } from "../../stores/motor-store";
import { useI18n } from "../../i18n";
import type { I18nKeys } from "../../i18n/zh";

export function MotorDashboard() {
  const { t } = useI18n();
  const motor = useMotorStore((s) => s.activeMotorId != null ? s.motors[s.activeMotorId] : null);
  const latest = motor?.feedback ?? null;

  const items: { labelKey: I18nKeys; value: number | null | undefined; unit: string; color: string }[] = [
    {
      labelKey: "motor.dashboard.angle",
      value: latest?.angle,
      unit: "rad",
      color: "text-blue-400",
    },
    {
      labelKey: "motor.dashboard.velocity",
      value: latest?.velocity,
      unit: "rad/s",
      color: "text-emerald-400",
    },
    {
      labelKey: "motor.dashboard.torque",
      value: latest?.torque,
      unit: "N.m",
      color: "text-amber-400",
    },
    {
      labelKey: "motor.dashboard.temperature",
      value: latest?.temperature,
      unit: "°C",
      color: "text-red-400",
    },
    {
      labelKey: "motor.dashboard.motorId",
      value: latest?.motor_id,
      unit: "",
      color: "text-zinc-300",
    },
  ];

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-zinc-900/80 border-t border-zinc-800 text-xs shrink-0">
      {items.map((item) => (
        <div key={item.labelKey} className="flex items-baseline gap-1.5">
          <span className="text-zinc-500">{t(item.labelKey)}</span>
          <span className={`font-mono ${item.color}`}>
            {item.value !== undefined && item.value !== null
              ? typeof item.value === "number" && item.unit
                ? item.value.toFixed(3)
                : item.value
              : "—"}
          </span>
          {item.unit && <span className="text-zinc-600">{item.unit}</span>}
        </div>
      ))}
    </div>
  );
}
