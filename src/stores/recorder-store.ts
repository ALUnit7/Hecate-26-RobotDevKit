import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { RecorderStatus } from "../types/recorder";
import { RECORDER_IDLE } from "../types/recorder";

interface RecorderStore {
  status: RecorderStatus;
  error: string;
  /** Start recording; pass empty string to auto-generate filename */
  start: (path?: string) => Promise<void>;
  stop: () => Promise<void>;
  /** Poll backend for current status (called periodically while recording) */
  poll: () => Promise<void>;
  setError: (err: string) => void;
}

export const useRecorderStore = create<RecorderStore>((set) => ({
  status: RECORDER_IDLE,
  error: "",

  start: async (path = "") => {
    set({ error: "" });
    try {
      const status = await invoke<RecorderStatus>("rec_start", { path });
      set({ status });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  stop: async () => {
    set({ error: "" });
    try {
      const status = await invoke<RecorderStatus>("rec_stop");
      set({ status });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  poll: async () => {
    try {
      const status = await invoke<RecorderStatus>("rec_status");
      set({ status });
    } catch {
      // silently ignore polling errors
    }
  },

  setError: (error) => set({ error }),
}));
