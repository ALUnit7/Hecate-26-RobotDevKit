import { useState } from "react";
import { FiX, FiCheck } from "react-icons/fi";
import {
  CONTROL_CANDIDATES,
  deriveControlType,
  type ChannelMapping,
  type ChannelType,
} from "../../types/presets";
import { usePresetStore } from "../../stores/preset-store";
import { cn } from "../../lib/utils";
import { useI18n } from "../../i18n";
import type { I18nKeys } from "../../i18n/zh";

interface Props {
  onClose: () => void;
}

/** Maps each channel type to its i18n key, used for the type dropdown. */
const TYPE_LABELS: Record<ChannelType, I18nKeys> = {
  stick: "channelType.stick",
  switch2: "channelType.switch2",
  switch3: "channelType.switch3",
  switchSpring: "channelType.switchSpring",
  knob: "channelType.knob",
  lever: "channelType.lever",
  trim: "channelType.trim",
  unassigned: "channelType.unassigned",
};

const ALL_TYPES = Object.keys(TYPE_LABELS) as ChannelType[];

export function PresetEditor({ onClose }: Props) {
  const { t } = useI18n();
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
            <h2 className="text-sm font-semibold text-zinc-100">{t("presetEditor.title")}</h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">{preset.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-[2.5rem_6rem_1fr_7rem_2.5rem] gap-2 px-5 py-2 bg-zinc-800/50 border-b border-zinc-800 text-[10px] text-zinc-500 font-mono shrink-0">
          <span>{t("presetEditor.col.ch")}</span>
          <span>{t("presetEditor.col.control")}</span>
          <span>{t("presetEditor.col.label")}</span>
          <span>{t("presetEditor.col.type")}</span>
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
                <option value="">{t("presetEditor.control.none")}</option>
                {CONTROL_CANDIDATES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {row.control && !CONTROL_CANDIDATES.includes(row.control) && (
                  <option value={row.control}>{t("presetEditor.control.custom", { c: row.control })}</option>
                )}
              </select>

              <input
                value={row.label}
                onChange={(e) => setRow(i, { label: e.target.value })}
                onBlur={() => commitRow(i)}
                placeholder={t("presetEditor.label.placeholder")}
                className="h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] px-2 focus:outline-none focus:border-zinc-500 w-full"
              />

              <select
                value={row.channelType}
                onChange={(e) => {
                  const ct = e.target.value as ChannelType;
                  setRow(i, { channelType: ct });
                  updateChannel(preset.id, i, { ...draft[i], channelType: ct });
                }}
                className="h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] px-1.5 focus:outline-none focus:border-zinc-500 w-full"
              >
                {ALL_TYPES.map((ct) => (
                  <option key={ct} value={ct}>{t(TYPE_LABELS[ct])}</option>
                ))}
              </select>

              <button onClick={() => commitRow(i)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-zinc-700 text-zinc-600 hover:text-emerald-400 transition-colors" title={t("presetEditor.row.apply")}>
                <FiCheck className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 shrink-0 bg-zinc-900">
          <span className="text-[10px] text-zinc-600">{t("presetEditor.footer.hint")}</span>
          <button onClick={commitAll} className={cn("flex items-center gap-1.5 h-7 px-4 rounded text-xs font-medium transition-colors", "bg-sky-500/20 text-sky-400 hover:bg-sky-500/30")}>
            <FiCheck className="w-3.5 h-3.5" />
            {t("presetEditor.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
