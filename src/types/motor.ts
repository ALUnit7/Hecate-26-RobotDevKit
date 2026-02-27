export interface MotorFeedback {
  motor_id: number;
  angle: number;    // rad
  velocity: number; // rad/s
  torque: number;   // N.m
  temperature: number; // °C
}

export interface CanFrameLog {
  direction: "tx" | "rx";
  can_id: number;
  is_extended: boolean;
  data: number[];
  timestamp_ms: number;
}

export interface UdpConfig {
  gateway_ip: string;
  gateway_port: number;
  local_port: number;
  motor_id: number;
  master_id: number;
}

export type MotorMode = 0 | 1 | 2; // 0=MIT, 1=Position, 2=Speed

export interface FaultStatus {
  raw: number;
  faults: string[];
}

export interface ParamReadResponse {
  index: number;
  success: boolean;
  value_bytes: number[];
  value_f32: number;
  value_u32: number;
}

export interface ParamDef {
  index: number;
  name: string;
  desc: string;
  paramType: string; // "U8" | "U16" | "U32" | "I16" | "F32"
  access: string;    // "R" | "W" | "RW"
  defaultStr: string;
}

export interface PrivateFeedback {
  motor_id: number;
  mode_status: number; // 0=Reset, 1=Cali, 2=Motor
  fault_bits: number;
  angle: number;
  velocity: number;
  torque: number;
  temperature: number;
}

export interface DiscoveredMotor {
  id: number;
  protocol: "private" | "mit" | "unknown";
}

export interface PerMotorState {
  feedback: MotorFeedback | null;
  history: MotorFeedback[];
  timestamps: number[];
  paramValues: Record<number, { value_f32: number; value_u32: number; raw: number[]; success: boolean }>;
  faultStatus: FaultStatus | null;
  privateFeedback: PrivateFeedback | null;
  deviceId: string | null;
  firmwareVersion: string | null;
  protocol: "private" | "mit" | "unknown";
}

export function createPerMotorState(protocol: "private" | "mit" | "unknown" = "unknown"): PerMotorState {
  return {
    feedback: null,
    history: [],
    timestamps: [],
    paramValues: {},
    faultStatus: null,
    privateFeedback: null,
    deviceId: null,
    firmwareVersion: null,
    protocol,
  };
}
