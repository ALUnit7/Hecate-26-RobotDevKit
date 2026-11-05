import { create } from "zustand";
import type { SbusData, SbusStats } from "../types/sbus";
import { CHANNEL_MID } from "../types/sbus";

const DEFAULT_CHANNELS = (): number[] => Array(16).fill(CHANNEL_MID); // 992 = mid (standard SBUS)

const DEFAULT_DATA: SbusData = {
  channels: DEFAULT_CHANNELS(),
  ch17: false,
  ch18: false,
  frame_lost: false,
  failsafe: false,
};

const DEFAULT_STATS: SbusStats = {
  bytes_received: 0,
  frames_received: 0,
  frames_invalid: 0,
  frames_lost: 0,
};

interface SbusStore {
  connected: boolean;
  portName: string;
  baudRate: number;
  data: SbusData;
  stats: SbusStats;
  signalLost: boolean;
  error: string;

  setConnected: (connected: boolean, portName?: string) => void;
  setData: (data: SbusData) => void;
  setStats: (stats: SbusStats) => void;
  setSignalLost: (lost: boolean) => void;
  setBaudRate: (rate: number) => void;
  setError: (err: string) => void;
  reset: () => void;
}

export const useSbusStore = create<SbusStore>((set) => ({
  connected: false,
  portName: "",
  baudRate: 100000,
  data: DEFAULT_DATA,
  stats: DEFAULT_STATS,
  signalLost: false,
  error: "",

  setConnected: (connected, portName) =>
    set((s) => ({
      connected,
      portName: portName ?? s.portName,
      signalLost: connected ? s.signalLost : false,
      error: connected ? "" : s.error,
    })),

  setData: (data) => set({ data, signalLost: false }),

  setStats: (stats) => set({ stats }),

  setSignalLost: (signalLost) => set({ signalLost }),

  setBaudRate: (baudRate) => set({ baudRate }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      data: DEFAULT_DATA,
      stats: DEFAULT_STATS,
      signalLost: false,
      error: "",
    }),
}));
