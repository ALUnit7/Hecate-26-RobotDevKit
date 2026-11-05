import { useState } from "react";
import {
  FiPlus,
  FiCopy,
  FiEdit2,
  FiTrash2,
  FiSliders,
  FiChevronDown,
} from "react-icons/fi";
import { usePresetStore } from "../../stores/preset-store";
import { cn } from "../../lib/utils";
import { useI18n } from "../../i18n";

interface Props {
  /** Open the channel-mapping editor panel */
  onEditChannels: () => void;
}

export function PresetToolbar({ onEditChannels }: Props) {
  const { t } = useI18n();
  const { presets, activeId, loaded, error, setActive, createPreset, duplicatePreset, renamePreset, deletePreset } =
    usePresetStore();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const active = presets.find((p) => p.id === activeId);

  if (!loaded) {
    return (
      <div className="flex items-center px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-600 shrink-0">
        {t("preset.loading")}
      </div>
    );
  }

  const handleRenameStart = () => {
    if (!active || active.builtIn) return;
    setRenaming(active.id);
    setRenameValue(active.name);
  };

  const handleRenameCommit = () => {
    if (renaming && renameValue.trim()) {
      renamePreset(renaming, renameValue.trim());
    }
    setRenaming(null);
  };

  const handleDelete = () => {
    if (!active || active.builtIn) return;
    if (confirm(t("preset.deleteConfirm", { name: active.name }))) {
      deletePreset(active.id);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs shrink-0 flex-wrap">
      {/* Preset selector */}
      <div className="relative flex items-center">
        <span className="text-zinc-500 mr-1">{t("preset.label")}</span>
        {renaming === activeId && active ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameCommit();
              if (e.key === "Escape") setRenaming(null);
            }}
            className="h-7 w-40 rounded bg-zinc-800 border border-sky-500 text-zinc-200 text-xs px-2 focus:outline-none"
          />
        ) : (
          <div className="relative">
            <select
              value={activeId}
              onChange={(e) => setActive(e.target.value)}
              className="h-7 pr-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-2 focus:outline-none focus:border-zinc-500 appearance-none"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.builtIn ? ` ${t("preset.builtIn")}` : ""}
                </option>
              ))}
            </select>
            <FiChevronDown className="w-3 h-3 text-zinc-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-zinc-700" />

      {/* New */}
      <button
        onClick={() => {
          const name = prompt(t("preset.new.prompt"), t("preset.new.defaultName"));
          if (name && name.trim()) createPreset(name.trim());
        }}
        className="flex items-center gap-1 h-7 px-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        title={t("preset.tooltip.new")}
      >
        <FiPlus className="w-3.5 h-3.5" />
      </button>

      {/* Duplicate */}
      <button
        onClick={() => active && duplicatePreset(active.id)}
        disabled={!active}
        className="flex items-center gap-1 h-7 px-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-30"
        title={t("preset.tooltip.duplicate")}
      >
        <FiCopy className="w-3.5 h-3.5" />
      </button>

      {/* Rename */}
      <button
        onClick={handleRenameStart}
        disabled={!active || active.builtIn}
        className="flex items-center gap-1 h-7 px-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-30"
        title={active?.builtIn ? t("preset.tooltip.renameDisabled") : t("preset.tooltip.rename")}
      >
        <FiEdit2 className="w-3.5 h-3.5" />
      </button>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={!active || active.builtIn}
        className="flex items-center gap-1 h-7 px-2 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-30"
        title={active?.builtIn ? t("preset.tooltip.deleteDisabled") : t("preset.tooltip.delete")}
      >
        <FiTrash2 className="w-3.5 h-3.5" />
      </button>

      {/* Edit channels — opens the mapping panel */}
      <button
        onClick={onEditChannels}
        disabled={!active || active.builtIn}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium transition-colors disabled:opacity-30",
          active && !active.builtIn
            ? "bg-sky-500/15 text-sky-400 hover:bg-sky-500/25"
            : "bg-zinc-800 text-zinc-500"
        )}
        title={active?.builtIn ? t("preset.tooltip.editDisabled") : t("preset.tooltip.editChannels")}
      >
        <FiSliders className="w-3.5 h-3.5" />
        {t("preset.btn.editChannels")}
      </button>

      {active?.builtIn && (
        <span className="text-[10px] text-zinc-600 ml-1">{t("preset.readOnly")}</span>
      )}

      {error && (
        <span className="w-full text-red-400 text-[10px] mt-0.5">{error}</span>
      )}
    </div>
  );
}
