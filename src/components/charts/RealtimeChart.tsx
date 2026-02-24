import { useEffect, useRef, useState, useMemo } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { useImuStore } from "../../stores/imu-store";
import { cn } from "../../lib/utils";

type TabKey = "acc" | "gyr" | "mag" | "euler";

const TAB_CONFIG: Record<
  TabKey,
  { label: string; unit: string; keys: string[]; colors: string[] }
> = {
  acc: {
    label: "Accelerometer",
    unit: "m/s²",
    keys: ["X", "Y", "Z"],
    colors: ["#ef4444", "#22c55e", "#3b82f6"],
  },
  gyr: {
    label: "Gyroscope",
    unit: "°/s",
    keys: ["X", "Y", "Z"],
    colors: ["#ef4444", "#22c55e", "#3b82f6"],
  },
  mag: {
    label: "Magnetometer",
    unit: "uT",
    keys: ["X", "Y", "Z"],
    colors: ["#ef4444", "#22c55e", "#3b82f6"],
  },
  euler: {
    label: "Euler Angles",
    unit: "°",
    keys: ["Roll", "Pitch", "Yaw"],
    colors: ["#f97316", "#a855f7", "#06b6d4"],
  },
};

export function RealtimeChart() {
  const [activeTab, setActiveTab] = useState<TabKey>("acc");
  const chartRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const history = useImuStore((s) => s.history);
  const timestamps = useImuStore((s) => s.timestamps);

  const config = TAB_CONFIG[activeTab];

  const chartData = useMemo(() => {
    if (history.length === 0) return null;

    // Convert timestamps to seconds relative to first
    const t0 = timestamps[0] || 0;
    const timeArr = new Float64Array(history.length);
    const ch1 = new Float64Array(history.length);
    const ch2 = new Float64Array(history.length);
    const ch3 = new Float64Array(history.length);

    for (let i = 0; i < history.length; i++) {
      timeArr[i] = (timestamps[i] - t0) / 1000;
      const d = history[i];
      switch (activeTab) {
        case "acc":
          ch1[i] = d.acc[0];
          ch2[i] = d.acc[1];
          ch3[i] = d.acc[2];
          break;
        case "gyr":
          ch1[i] = d.gyr[0];
          ch2[i] = d.gyr[1];
          ch3[i] = d.gyr[2];
          break;
        case "mag":
          ch1[i] = d.mag[0];
          ch2[i] = d.mag[1];
          ch3[i] = d.mag[2];
          break;
        case "euler":
          ch1[i] = d.roll;
          ch2[i] = d.pitch;
          ch3[i] = d.yaw;
          break;
      }
    }

    return [timeArr, ch1, ch2, ch3] as uPlot.AlignedData;
  }, [history, timestamps, activeTab]);

  // Create/destroy uPlot instance
  useEffect(() => {
    if (!chartRef.current) return;

    const el = chartRef.current;
    const width = el.clientWidth || 600;
    const height = el.clientHeight || 280;

    const opts: uPlot.Options = {
      width,
      height,
      cursor: { show: false },
      select: { show: false, left: 0, top: 0, width: 0, height: 0 },
      legend: { show: true },
      scales: {
        x: { time: false },
      },
      axes: [
        {
          stroke: "#71717a",
          grid: { stroke: "#27272a", width: 1 },
          ticks: { stroke: "#3f3f46" },
          font: "11px monospace",
          label: "Time (s)",
          labelFont: "11px sans-serif",
          labelGap: 4,
        },
        {
          stroke: "#71717a",
          grid: { stroke: "#27272a", width: 1 },
          ticks: { stroke: "#3f3f46" },
          font: "11px monospace",
          label: `${config.label} (${config.unit})`,
          labelFont: "11px sans-serif",
          labelGap: 4,
        },
      ],
      series: [
        { label: "Time" },
        {
          label: config.keys[0],
          stroke: config.colors[0],
          width: 1.5,
        },
        {
          label: config.keys[1],
          stroke: config.colors[1],
          width: 1.5,
        },
        {
          label: config.keys[2],
          stroke: config.colors[2],
          width: 1.5,
        },
      ],
    };

    const initData: uPlot.AlignedData = [[0], [0], [0], [0]];
    const u = new uPlot(opts, initData, el);
    uplotRef.current = u;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          u.setSize({ width: w, height: h });
        }
      }
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      u.destroy();
      uplotRef.current = null;
    };
  }, [activeTab, config]);

  // Update data
  useEffect(() => {
    if (uplotRef.current && chartData) {
      uplotRef.current.setData(chartData);
    }
  }, [chartData]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 px-3 pt-2">
        {(Object.keys(TAB_CONFIG) as TabKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-t-md transition-colors",
              activeTab === key
                ? "bg-zinc-800 text-zinc-100 border-t border-x border-zinc-700"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            )}
          >
            {TAB_CONFIG[key].label}
          </button>
        ))}
      </div>
      {/* Chart container */}
      <div ref={chartRef} className="flex-1 min-h-0 px-2 pb-2" />
    </div>
  );
}
