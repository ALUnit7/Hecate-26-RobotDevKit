import { Link } from "react-router-dom";
import { FiSliders, FiList, FiArrowRight } from "react-icons/fi";

interface ModeOption {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  status: "ready";
}

const modes: ModeOption[] = [
  {
    title: "Mapped Mode",
    description:
      "Visualize channels with preset labels and type-aware rendering. Sticks show bipolar bars, switches show state indicators, knobs show unipolar bars. Requires a preset configuration.",
    path: "/remote-debug/mapped",
    icon: <FiSliders className="w-6 h-6" />,
    status: "ready",
  },
  {
    title: "Raw Channels",
    description:
      "Plain 16-channel view with no mapping applied. All channels display as simple horizontal bars with raw 172–1811 values. Useful for quick diagnosis or first-time setup.",
    path: "/remote-debug/raw",
    icon: <FiList className="w-6 h-6" />,
    status: "ready",
  },
];

export function RemoteSelectPage() {
  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-3xl mx-auto mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Remote Debugger</h1>
        <p className="mt-1 text-zinc-400 text-sm">
          SBUS RC receiver channel visualization. Select a view mode.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {modes.map((m) => (
          <Link key={m.path} to={m.path} className="no-underline block">
            <div className="group flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/80 cursor-pointer p-5 transition-all">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 text-zinc-400">{m.icon}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-semibold text-zinc-100">{m.title}</h2>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      Ready
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{m.description}</p>
                </div>
              </div>
              <FiArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0 ml-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
