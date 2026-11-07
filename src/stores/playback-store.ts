/**
 * Playback engine for recorded .jsonl files.
 *
 * Workflow:
 *   1. User opens a .jsonl file → load() parses all entries
 *   2. play() starts a requestAnimationFrame loop that walks the timeline
 *   3. Each tick dispatches entries whose `t` has elapsed into the relevant stores
 *   4. Controls: pause, seek (0..1), speed (0.25x..4x), stop
 *
 * Data injection goes directly into store actions (no Tauri event overhead).
 * The hook usePlayback() must be mounted for the RAF loop to run.
 */
import { create } from "zustand";

// ── Parsed entry types ──────────────────────────────────────────────────────

interface BaseEntry { t: number; src: string }

interface ImuEntry extends BaseEntry {
  src: "imu";
  acc: [number, number, number];
  gyr: [number, number, number];
  mag: [number, number, number];
  roll: number; pitch: number; yaw: number;
  quat: [number, number, number, number];
  temperature: number;
  air_pressure: number;
  system_time: number;
}

interface MotorEntry extends BaseEntry {
  src: "motor";
  motor_id: number;
  angle: number;
  velocity: number;
  torque: number;
  temperature: number;
}

interface MotorPrivateEntry extends BaseEntry {
  src: "motor_private";
  motor_id: number;
  mode_status: number;
  fault_bits: number;
  angle: number;
  velocity: number;
  torque: number;
  temperature: number;
}

interface SbusEntry extends BaseEntry {
  src: "sbus";
  channels: number[];
  ch17: boolean;
  ch18: boolean;
  frame_lost: boolean;
  failsafe: boolean;
}

export type PlaybackEntry = ImuEntry | MotorEntry | MotorPrivateEntry | SbusEntry;

// ── Store ───────────────────────────────────────────────────────────────────

export type PlaybackState = "idle" | "playing" | "paused";

interface PlaybackStore {
  state: PlaybackState;
  entries: PlaybackEntry[];
  /** Total duration in seconds */
  duration: number;
  /** Current playback position in seconds */
  position: number;
  /** Playback speed multiplier */
  speed: number;
  /** Path of the loaded file */
  filePath: string;
  /** Error message */
  error: string;

  /** Parse and load a .jsonl file content */
  load: (content: string, path: string) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (fraction: number) => void;
  setSpeed: (s: number) => void;
  /** Internal: advance position (called from RAF loop) */
  _advance: (dt: number) => void;
  setError: (e: string) => void;
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  state: "idle",
  entries: [],
  duration: 0,
  position: 0,
  speed: 1,
  filePath: "",
  error: "",

  load: (content, path) => {
    const entries: PlaybackEntry[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed) as PlaybackEntry;
        if (typeof obj.t === "number" && typeof obj.src === "string") {
          entries.push(obj);
        }
      } catch {
        // skip malformed lines
      }
    }
    entries.sort((a, b) => a.t - b.t);
    const duration = entries.length > 0 ? entries[entries.length - 1].t : 0;
    set({ entries, duration, position: 0, state: "idle", filePath: path, error: "" });
  },

  play: () => {
    if (get().entries.length === 0) return;
    // If at end, restart from beginning
    const pos = get().position;
    const dur = get().duration;
    set({ state: "playing", position: pos >= dur ? 0 : pos });
  },

  pause: () => set({ state: "paused" }),

  stop: () => set({ state: "idle", position: 0 }),

  seek: (fraction) => {
    const dur = get().duration;
    set({ position: Math.max(0, Math.min(dur, fraction * dur)) });
  },

  setSpeed: (speed) => set({ speed }),

  _advance: (dt) => {
    const { state, position, duration, speed } = get();
    if (state !== "playing") return;
    const next = position + dt * speed;
    if (next >= duration) {
      set({ position: duration, state: "paused" });
    } else {
      set({ position: next });
    }
  },

  setError: (error) => set({ error }),
}));
