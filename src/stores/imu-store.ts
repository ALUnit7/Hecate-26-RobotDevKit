import { create } from "zustand";
import type { ImuData } from "../types/imu";

const MAX_HISTORY = 600; // ~10 seconds at 60fps

interface ImuStore {
  // Connection
  connected: boolean;
  portName: string;
  baudRate: number;

  // Data
  latest: ImuData | null;
  history: ImuData[];
  timestamps: number[];

  // Recording
  recording: boolean;

  // Frame rate tracking
  frameCount: number;
  fps: number;

  // Console
  consoleLines: string[];

  // Actions
  setConnected: (connected: boolean) => void;
  setPortName: (name: string) => void;
  setBaudRate: (rate: number) => void;
  pushData: (data: ImuData) => void;
  setRecording: (recording: boolean) => void;
  incrementFrameCount: () => void;
  setFps: (fps: number) => void;
  addConsoleLine: (line: string) => void;
  clearConsole: () => void;
  reset: () => void;
}

export const useImuStore = create<ImuStore>((set) => ({
  connected: false,
  portName: "",
  baudRate: 115200,
  latest: null,
  history: [],
  timestamps: [],
  recording: false,
  frameCount: 0,
  fps: 0,
  consoleLines: [],

  setConnected: (connected) => set({ connected }),
  setPortName: (portName) => set({ portName }),
  setBaudRate: (baudRate) => set({ baudRate }),

  pushData: (data) =>
    set((state) => {
      const history = [...state.history, data];
      const timestamps = [...state.timestamps, Date.now()];
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
        timestamps.splice(0, timestamps.length - MAX_HISTORY);
      }
      return { latest: data, history, timestamps };
    }),

  setRecording: (recording) => set({ recording }),
  incrementFrameCount: () =>
    set((state) => ({ frameCount: state.frameCount + 1 })),
  setFps: (fps) => set({ fps, frameCount: 0 }),

  addConsoleLine: (line) =>
    set((state) => {
      const lines = [...state.consoleLines, line];
      if (lines.length > 200) lines.splice(0, lines.length - 200);
      return { consoleLines: lines };
    }),
  clearConsole: () => set({ consoleLines: [] }),

  reset: () =>
    set({
      latest: null,
      history: [],
      timestamps: [],
      frameCount: 0,
      fps: 0,
    }),
}));
