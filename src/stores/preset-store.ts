import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { PresetsFile, SbusPreset, ChannelMapping } from "../types/presets";
import { blankPreset, defaultMapping } from "../types/presets";

interface PresetStore {
  /** All presets (built-in + user-defined) */
  presets: SbusPreset[];
  /** ID of the currently active preset */
  activeId: string;
  /** Loaded flag */
  loaded: boolean;
  /** Error message */
  error: string;

  /** Load presets from disk on mount */
  load: () => Promise<void>;
  /** Persist current presets + activeId to disk */
  save: () => Promise<void>;
  /** Switch the active preset by id */
  setActive: (id: string) => void;

  /** Create a new blank preset and switch to it */
  createPreset: (name: string) => void;
  /** Duplicate a preset (copies channels, strips built-in flag) */
  duplicatePreset: (id: string) => void;
  /** Rename a preset (built-in cannot be renamed) */
  renamePreset: (id: string, name: string) => void;
  /** Delete a preset (built-in cannot be deleted); switches active if needed */
  deletePreset: (id: string) => void;

  /** Update one channel mapping inside a preset */
  updateChannel: (presetId: string, chIndex: number, mapping: ChannelMapping) => void;
}

export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: [],
  activeId: "",
  loaded: false,
  error: "",

  load: async () => {
    try {
      const file = await invoke<PresetsFile>("sbus_load_presets");
      set({ presets: file.presets, activeId: file.activeId, loaded: true, error: "" });
    } catch (e) {
      set({ error: String(e), loaded: true });
    }
  },

  save: async () => {
    const { presets, activeId } = get();
    try {
      await invoke("sbus_save_presets", {
        presetsFile: { version: 1, activeId, presets },
      });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setActive: (id) => set({ activeId: id }),

  createPreset: (name) => {
    const p = blankPreset(name || "新建预设");
    set((s) => ({ presets: [...s.presets, p], activeId: p.id }));
    get().save();
  },

  duplicatePreset: (id) => {
    const src = get().presets.find((p) => p.id === id);
    if (!src) return;
    const now = Date.now();
    const copy: SbusPreset = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} (副本)`,
      builtIn: false,
      createdAt: now,
      updatedAt: now,
      channels: src.channels.map((c) => ({ ...c })),
    };
    set((s) => ({ presets: [...s.presets, copy], activeId: copy.id }));
    get().save();
  },

  renamePreset: (id, name) => {
    set((s) => ({
      presets: s.presets.map((p) =>
        p.id === id && !p.builtIn ? { ...p, name, updatedAt: Date.now() } : p
      ),
    }));
    get().save();
  },

  deletePreset: (id) => {
    set((s) => {
      const target = s.presets.find((p) => p.id === id);
      if (!target || target.builtIn) return s;
      const presets = s.presets.filter((p) => p.id !== id);
      // If we deleted the active preset, fall back to the first remaining
      const activeId = s.activeId === id ? presets[0]?.id ?? "" : s.activeId;
      return { presets, activeId };
    });
    get().save();
  },

  updateChannel: (presetId, chIndex, mapping) => {
    set((s) => ({
      presets: s.presets.map((p) => {
        if (p.id !== presetId || p.builtIn) return p;
        const channels = p.channels.map((c, i) => (i === chIndex ? { ...mapping } : c));
        return { ...p, channels, updatedAt: Date.now() };
      }),
    }));
    get().save();
  },
}));

/** Resolve the currently active preset's mapping for a channel index */
export function selectActivePreset(s: PresetStore): SbusPreset | undefined {
  return s.presets.find((p) => p.id === s.activeId);
}

/** Resolve a channel mapping, falling back to a default if missing */
export function selectChannelMapping(s: PresetStore, index: number): ChannelMapping {
  const p = selectActivePreset(s);
  return p?.channels[index] ?? defaultMapping(index);
}
