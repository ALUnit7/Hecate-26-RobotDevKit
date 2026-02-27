import { useRef, useEffect, useState, useCallback } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { useMotorStore } from "../../stores/motor-store";

const TABS = ["Angle", "Velocity", "Torque", "Temperature"] as const;

const TAB_CONFIG: Record<
  (typeof TABS)[number],
  { key: keyof { angle: number; velocity: number; torque: number; temperature: number }; color: string; unit: string }
> = {
  Angle: { key: "angle", color: "#60a5fa", unit: "rad" },
  Velocity: { key: "velocity", color: "#34d399", unit: "rad/s" },
  Torque: { key: "torque", color: "#fbbf24", unit: "N.m" },
  Temperature: { key: "temperature", color: "#f87171", unit: "°C" },
};

export function MotorChart() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Angle");
  const chartRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const activeMotorId = useMotorStore((s) => s.activeMotorId);
  const motor = useMotorStore((s) => s.activeMotorId != null ? s.motors[s.activeMotorId] : null);
  const history = motor?.history ?? [];
  const timestamps = motor?.timestamps ?? [];

  const buildData = useCallback((): uPlot.AlignedData => {
    const cfg = TAB_CONFIG[activeTab];
    const t = new Float64Array(timestamps.map((ts) => ts / 1000));
    const vals = new Float64Array(
      history.map((fb) => fb[cfg.key as keyof typeof fb] as number)
    );
    return [t, vals];
  }, [activeTab, history, timestamps]);

  useEffect(() => {
    if (!chartRef.current) return;
    const el = chartRef.current;
    const cfg = TAB_CONFIG[activeTab];

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: el.clientHeight,
      cursor: { show: false },
      legend: { show: true },
      scales: {
        x: { time: true },
      },
      axes: [
        {
          stroke: "#71717a",
          grid: { stroke: "#27272a" },
          ticks: { stroke: "#3f3f46" },
        },
        {
          stroke: "#71717a",
          grid: { stroke: "#27272a" },
          ticks: { stroke: "#3f3f46" },
          label: cfg.unit,
        },
      ],
      series: [
        {},
        {
          label: activeTab,
          stroke: cfg.color,
          width: 1.5,
        },
      ],
    };

    const plot = new uPlot(opts, buildData(), el);
    uplotRef.current = plot;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        plot.setSize({ width, height });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      plot.destroy();
      uplotRef.current = null;
    };
    // Recreate chart when tab or active motor changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeMotorId]);

  // Update data without recreating chart
  useEffect(() => {
    if (uplotRef.current) {
      uplotRef.current.setData(buildData());
    }
  }, [buildData]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === tab
                ? "text-zinc-100 border-b-2 border-blue-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div ref={chartRef} className="flex-1 min-h-0" />
    </div>
  );
}
