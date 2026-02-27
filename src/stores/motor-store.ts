import { create } from "zustand";
import type { MotorFeedback, CanFrameLog, UdpConfig, FaultStatus, ParamReadResponse, ParamDef, PrivateFeedback, DiscoveredMotor, PerMotorState } from "../types/motor";
import { createPerMotorState } from "../types/motor";

const MAX_HISTORY = 600;
const MAX_LOG_LINES = 200;

interface MotorState {
  // Connection
  connected: boolean;
  config: UdpConfig;
  setConfig: (config: Partial<UdpConfig>) => void;
  setConnected: (connected: boolean) => void;

  // Multi-motor
  motors: Record<number, PerMotorState>;
  activeMotorId: number | null;
  discoveredMotors: DiscoveredMotor[];
  addMotor: (id: number, protocol: "private" | "mit" | "unknown") => void;
  removeAllMotors: () => void;
  setActiveMotor: (id: number) => void;
  setDiscoveredMotors: (motors: DiscoveredMotor[]) => void;

  // Feedback (routes by motor_id)
  fps: number;
  setFps: (fps: number) => void;
  pushFeedback: (fb: MotorFeedback) => void;

  // CAN frame log (global)
  canLog: CanFrameLog[];
  pushCanLog: (entry: CanFrameLog) => void;
  clearCanLog: () => void;

  // Fault status (for active motor)
  setFaultStatus: (fs: FaultStatus) => void;

  // Private protocol feedback
  setPrivateFeedback: (fb: PrivateFeedback) => void;

  // UDP warning
  udpWarning: string;
  setUdpWarning: (msg: string) => void;

  // Parameter table (global definition)
  paramTable: ParamDef[];
  setParamTable: (table: ParamDef[]) => void;
  setParamValue: (resp: ParamReadResponse) => void;
  clearParamValues: () => void;

  // Device info
  setDeviceInfo: (motorId: number, deviceId: string) => void;
  setFirmwareVersion: (motorId: number, version: string) => void;

  // MIT loop state
  mitLoopRunning: boolean;
  mitLoopFrequency: number;
  setMitLoopRunning: (running: boolean) => void;
  setMitLoopFrequency: (freq: number) => void;

  // Convenience selectors
  activeMotor: () => PerMotorState | null;
}

function ensureMotor(motors: Record<number, PerMotorState>, id: number, protocol?: "private" | "mit" | "unknown"): Record<number, PerMotorState> {
  if (motors[id]) return motors;
  return { ...motors, [id]: createPerMotorState(protocol) };
}

export const useMotorStore = create<MotorState>((set, get) => ({
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

  // Multi-motor
  motors: {},
  activeMotorId: null,
  discoveredMotors: [],
  addMotor: (id, protocol) =>
    set((s) => ({
      motors: ensureMotor(s.motors, id, protocol),
      activeMotorId: s.activeMotorId ?? id,
    })),
  removeAllMotors: () => set({ motors: {}, activeMotorId: null, discoveredMotors: [] }),
  setActiveMotor: (id) => set({ activeMotorId: id }),
  setDiscoveredMotors: (motors) => set({ discoveredMotors: motors }),

  fps: 0,
  setFps: (fps) => set({ fps }),
  pushFeedback: (fb) =>
    set((s) => {
      const id = fb.motor_id;
      const updated = ensureMotor(s.motors, id);
      const motor = { ...updated[id] };
      const history = [...motor.history, fb];
      const timestamps = [...motor.timestamps, Date.now()];
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
        timestamps.splice(0, timestamps.length - MAX_HISTORY);
      }
      motor.feedback = fb;
      motor.history = history;
      motor.timestamps = timestamps;
      return { motors: { ...updated, [id]: motor } };
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

  setFaultStatus: (fs) =>
    set((s) => {
      const id = s.activeMotorId;
      if (id == null) return {};
      const updated = ensureMotor(s.motors, id);
      return { motors: { ...updated, [id]: { ...updated[id], faultStatus: fs } } };
    }),

  setPrivateFeedback: (fb) =>
    set((s) => {
      const id = fb.motor_id;
      const updated = ensureMotor(s.motors, id);
      return { motors: { ...updated, [id]: { ...updated[id], privateFeedback: fb } } };
    }),

  udpWarning: "",
  setUdpWarning: (msg) => set({ udpWarning: msg }),

  paramTable: [],
  setParamTable: (table) => set({ paramTable: table }),
  setParamValue: (resp) =>
    set((s) => {
      const id = s.activeMotorId;
      if (id == null) return {};
      const updated = ensureMotor(s.motors, id);
      const motor = updated[id];
      return {
        motors: {
          ...updated,
          [id]: {
            ...motor,
            paramValues: {
              ...motor.paramValues,
              [resp.index]: {
                value_f32: resp.value_f32,
                value_u32: resp.value_u32,
                raw: resp.value_bytes,
                success: resp.success,
              },
            },
          },
        },
      };
    }),
  clearParamValues: () =>
    set((s) => {
      const id = s.activeMotorId;
      if (id == null) return {};
      const updated = ensureMotor(s.motors, id);
      return { motors: { ...updated, [id]: { ...updated[id], paramValues: {} } } };
    }),

  setDeviceInfo: (motorId, deviceId) =>
    set((s) => {
      const updated = ensureMotor(s.motors, motorId);
      return { motors: { ...updated, [motorId]: { ...updated[motorId], deviceId } } };
    }),
  setFirmwareVersion: (motorId, version) =>
    set((s) => {
      const updated = ensureMotor(s.motors, motorId);
      return { motors: { ...updated, [motorId]: { ...updated[motorId], firmwareVersion: version } } };
    }),

  mitLoopRunning: false,
  mitLoopFrequency: 200,
  setMitLoopRunning: (running) => set({ mitLoopRunning: running }),
  setMitLoopFrequency: (freq) => set({ mitLoopFrequency: freq }),

  activeMotor: () => {
    const s = get();
    return s.activeMotorId != null ? (s.motors[s.activeMotorId] ?? null) : null;
  },
}));
