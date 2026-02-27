import { create } from "zustand";
import type { MotorFeedback, CanFrameLog, UdpConfig, FaultStatus, ParamReadResponse, ParamDef, PrivateFeedback } from "../types/motor";

const MAX_HISTORY = 600;
const MAX_LOG_LINES = 200;

interface MotorState {
  // Connection
  connected: boolean;
  config: UdpConfig;
  setConfig: (config: Partial<UdpConfig>) => void;
  setConnected: (connected: boolean) => void;

  // Feedback
  latest: MotorFeedback | null;
  history: MotorFeedback[];
  timestamps: number[];
  fps: number;
  setFps: (fps: number) => void;
  pushFeedback: (fb: MotorFeedback) => void;

  // CAN frame log
  canLog: CanFrameLog[];
  pushCanLog: (entry: CanFrameLog) => void;
  clearCanLog: () => void;

  // Fault status
  faultStatus: FaultStatus | null;
  setFaultStatus: (fs: FaultStatus) => void;

  // Private protocol feedback (type 2)
  privateFeedback: PrivateFeedback | null;
  setPrivateFeedback: (fb: PrivateFeedback) => void;

  // UDP warning
  udpWarning: string;
  setUdpWarning: (msg: string) => void;

  // Parameter table
  paramTable: ParamDef[];
  setParamTable: (table: ParamDef[]) => void;
  paramValues: Record<number, { value_f32: number; value_u32: number; raw: number[]; success: boolean }>;
  setParamValue: (resp: ParamReadResponse) => void;
  clearParamValues: () => void;

  // Device info
  deviceId: string | null;      // 64-bit MCU ID as hex
  deviceMotorId: number | null;
  firmwareVersion: string | null;
  setDeviceInfo: (motorId: number, deviceId: string) => void;
  setFirmwareVersion: (motorId: number, version: string) => void;
}

export const useMotorStore = create<MotorState>((set) => ({
  connected: false,
  config: {
    gateway_ip: "192.168.0.7",
    gateway_port: 20001,
    local_port: 20001,
    motor_id: 127,
    master_id: 253,
  },
  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),
  setConnected: (connected) => set({ connected }),

  latest: null,
  history: [],
  timestamps: [],
  fps: 0,
  setFps: (fps) => set({ fps }),
  pushFeedback: (fb) =>
    set((s) => {
      const history = [...s.history, fb];
      const timestamps = [...s.timestamps, Date.now()];
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
        timestamps.splice(0, timestamps.length - MAX_HISTORY);
      }
      return { latest: fb, history, timestamps };
    }),

  canLog: [],
  pushCanLog: (entry) =>
    set((s) => {
      const canLog = [...s.canLog, entry];
      if (canLog.length > MAX_LOG_LINES) {
        canLog.splice(0, canLog.length - MAX_LOG_LINES);
      }
      return { canLog };
    }),
  clearCanLog: () => set({ canLog: [] }),

  faultStatus: null,
  setFaultStatus: (fs) => set({ faultStatus: fs }),

  privateFeedback: null,
  setPrivateFeedback: (fb) => set({ privateFeedback: fb }),

  udpWarning: "",
  setUdpWarning: (msg) => set({ udpWarning: msg }),

  paramTable: [],
  setParamTable: (table) => set({ paramTable: table }),
  paramValues: {},
  setParamValue: (resp) =>
    set((s) => ({
      paramValues: {
        ...s.paramValues,
        [resp.index]: {
          value_f32: resp.value_f32,
          value_u32: resp.value_u32,
          raw: resp.value_bytes,
          success: resp.success,
        },
      },
    })),
  clearParamValues: () => set({ paramValues: {} }),

  deviceId: null,
  deviceMotorId: null,
  firmwareVersion: null,
  setDeviceInfo: (motorId, deviceId) => set({ deviceMotorId: motorId, deviceId }),
  setFirmwareVersion: (_motorId, version) => set({ firmwareVersion: version }),
}));
