import { useState } from "react";
import { FiX, FiCheck } from "react-icons/fi";
import {
  CONTROL_CANDIDATES,
  CHANNEL_TYPE_LABELS,
  deriveControlType,
  type ChannelMapping,
  type ChannelType,
} from "../../types/presets";
import { usePresetStore } from "../../stores/preset-store";
import { cn } from "../../lib/utils";

interface Props {
  onClose: () => void;
}

const ALL_TYPES = Object.entries(CHANNEL_TYPE_LABELS) as [ChannelType, string][];

export function PresetEditor({ onClose }: Props) {
  const { presets, activeId, updateChannel } = usePresetStore();
  const preset = presets.find((p) => p.id === activeId);

  const [draft, setDraft] = useState<ChannelMapping[]>(
    () => preset?.channels.map((c) => ({ ...c })) ?? []
  );

  if (!preset) return null;

  const setRow = (index: number, patch: Partial<ChannelMapping>) => {
    setDraft((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  };

  const handleControlChange = (index: number, control: string) => {
    const prevType = draft[index].channelType;
    const prevControl = draft[index].control;
    const prevWasAuto = prevControl === "" || deriveControlType(prevControl) === prevType;
    const autoType = deriveControlType(control);
    const newType = prevWasAuto ? autoType : prevType;

    setDraft((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, control, channelType: newType } : c
      )
    );
    updateChannel(preset.id, index, { ...draft[index], control, channelType: newType });
  };

  const commitRow = (index: number) => {
    updateChannel(preset.id, index, draft[index]);
  };

  const commitAll = () => {
    draft.forEach((_, i) => updateChannel(preset.id, i, draft[i]));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">编辑通道映射</h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">{preset.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-[2.5rem_6rem_1fr_7rem_2.5rem] gap-2 px-5 py-2 bg-zinc-800/50 border-b border-zinc-800 text-[10px] text-zinc-500 font-mono shrink-0">
          <span>CH</span>
          <span>控件</span>
          <span>标签</span>
          <span>类型 (自动)</span>
          <span></span>
        </div>

        <div className="overflow-y-auto flex-1">
          {draft.map((row, i) => (
            <div key={i} className="grid grid-cols-[2.5rem_6rem_1fr_7rem_2.5rem] gap-2 items-center px-5 py-1.5 border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
              <span className="text-[10px] text-zinc-600 font-mono">{String(i + 1).padStart(2, "0")}</span>

              <select
                value={row.control}
                onChange={(e) => handleControlChange(i, e.target.value)}
                className="h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] px-1.5 focus:outline-none focus:border-zinc-500 w-full"
              >
                <option value="">—</option>
                {CONTROL_CANDIDATES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {row.control && !CONTROL_CANDIDATES.includes(row.control) && (
                  <option value={row.control}>{row.control} (自定义)</option>
                )}
              </select>

              <input
                value={row.label}
                onChange={(e) => setRow(i, { label: e.target.value })}
                onBlur={() => commitRow(i)}
                placeholder="自定义标签…"
                className="h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] px-2 focus:outline-none focus:border-zinc-500 w-full"
              />

              <select
                value={row.channelType}
                onChange={(e) => {
                  const t = e.target.value as ChannelType;
                  setRow(i, { channelType: t });
                  updateChannel(preset.id, i, { ...draft[i], channelType: t });
                }}
                className="h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] px-1.5 focus:outline-none focus:border-zinc-500 w-full"
              >
                {ALL_TYPES.map(([t, label]) => (
                  <option key={t} value={t}>{label}</option>
                ))}
              </select>

              <button onClick={() => commitRow(i)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-zinc-700 text-zinc-600 hover:text-emerald-400 transition-colors" title="应用此行">
                <FiCheck className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 shrink-0 bg-zinc-900">
          <span className="text-[10px] text-zinc-600">选择控件后类型自动推导 · 仍可手动覆盖 · 修改实时保存</span>
          <button onClick={commitAll} className={cn("flex items-center gap-1.5 h-7 px-4 rounded text-xs font-medium transition-colors", "bg-sky-500/20 text-sky-400 hover:bg-sky-500/30")}>
            <FiCheck className="w-3.5 h-3.5" />
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
