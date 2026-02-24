import { useImuStore } from "../../stores/imu-store";

function fmt(v: number | undefined, decimals = 3): string {
  if (v === undefined || v === null) return "---";
  return v.toFixed(decimals);
}

export function DataDashboard() {
  const latest = useImuStore((s) => s.latest);

  if (!latest) {
    return (
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="text-zinc-500 text-sm">Waiting for data...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
      <div className="grid grid-cols-6 gap-3 text-sm">
        {/* Accelerometer */}
        <div className="space-y-1">
          <div className="text-zinc-400 font-medium text-xs uppercase tracking-wider">
            Acc (m/s²)
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-zinc-200 font-mono">
            <span className="text-red-400">X</span>
            <span>{fmt(latest.acc[0])}</span>
            <span className="text-green-400">Y</span>
            <span>{fmt(latest.acc[1])}</span>
            <span className="text-blue-400">Z</span>
            <span>{fmt(latest.acc[2])}</span>
          </div>
        </div>

        {/* Gyroscope */}
        <div className="space-y-1">
          <div className="text-zinc-400 font-medium text-xs uppercase tracking-wider">
            Gyr (°/s)
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-zinc-200 font-mono">
            <span className="text-red-400">X</span>
            <span>{fmt(latest.gyr[0])}</span>
            <span className="text-green-400">Y</span>
            <span>{fmt(latest.gyr[1])}</span>
            <span className="text-blue-400">Z</span>
            <span>{fmt(latest.gyr[2])}</span>
          </div>
        </div>

        {/* Magnetometer */}
        <div className="space-y-1">
          <div className="text-zinc-400 font-medium text-xs uppercase tracking-wider">
            Mag (uT)
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-zinc-200 font-mono">
            <span className="text-red-400">X</span>
            <span>{fmt(latest.mag[0], 1)}</span>
            <span className="text-green-400">Y</span>
            <span>{fmt(latest.mag[1], 1)}</span>
            <span className="text-blue-400">Z</span>
            <span>{fmt(latest.mag[2], 1)}</span>
          </div>
        </div>

        {/* Euler angles */}
        <div className="space-y-1">
          <div className="text-zinc-400 font-medium text-xs uppercase tracking-wider">
            Euler (°)
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-zinc-200 font-mono">
            <span className="text-orange-400">R</span>
            <span>{fmt(latest.roll, 2)}</span>
            <span className="text-orange-400">P</span>
            <span>{fmt(latest.pitch, 2)}</span>
            <span className="text-orange-400">Y</span>
            <span>{fmt(latest.yaw, 2)}</span>
          </div>
        </div>

        {/* Quaternion */}
        <div className="space-y-1">
          <div className="text-zinc-400 font-medium text-xs uppercase tracking-wider">
            Quaternion
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-zinc-200 font-mono">
            <span className="text-purple-400">w</span>
            <span>{fmt(latest.quat[0], 4)}</span>
            <span className="text-purple-400">x</span>
            <span>{fmt(latest.quat[1], 4)}</span>
            <span className="text-purple-400">y</span>
            <span>{fmt(latest.quat[2], 4)}</span>
            <span className="text-purple-400">z</span>
            <span>{fmt(latest.quat[3], 4)}</span>
          </div>
        </div>

        {/* Environment */}
        <div className="space-y-1">
          <div className="text-zinc-400 font-medium text-xs uppercase tracking-wider">
            Environment
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-zinc-200 font-mono">
            <span className="text-yellow-400">T</span>
            <span>{latest.temperature}°C</span>
            <span className="text-yellow-400">P</span>
            <span>{fmt(latest.air_pressure / 1000, 2)} kPa</span>
            <span className="text-yellow-400">t</span>
            <span>{(latest.system_time / 1000).toFixed(1)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
