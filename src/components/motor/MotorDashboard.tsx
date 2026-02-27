import { useMotorStore } from "../../stores/motor-store";

export function MotorDashboard() {
  const latest = useMotorStore((s) => s.latest);

  const items = [
    {
      label: "Angle",
      value: latest?.angle,
      unit: "rad",
      color: "text-blue-400",
    },
    {
      label: "Velocity",
      value: latest?.velocity,
      unit: "rad/s",
      color: "text-emerald-400",
    },
    {
      label: "Torque",
      value: latest?.torque,
      unit: "N.m",
      color: "text-amber-400",
    },
    {
      label: "Temperature",
      value: latest?.temperature,
      unit: "°C",
      color: "text-red-400",
    },
    {
      label: "Motor ID",
      value: latest?.motor_id,
      unit: "",
      color: "text-zinc-300",
    },
  ];

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-zinc-900/80 border-t border-zinc-800 text-xs shrink-0">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <span className="text-zinc-500">{item.label}</span>
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
