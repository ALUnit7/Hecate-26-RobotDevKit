/// Channel rendering / interpretation mode (mirrors Rust ChannelType enum)
export type ChannelType =
  | "stick"
  | "switch2"
  | "switch3"
  | "switchSpring"
  | "knob"
  | "lever"
  | "trim"
  | "unassigned";

export interface ChannelMapping {
  /** Display label shown on the channel bar (free text) */
  label: string;
  /** Transmitter control identifier, e.g. "J1", "SA", "LD" (free text) */
  control: string;
  /** How to render and interpret this channel's value */
  channelType: ChannelType;
}

export interface SbusPreset {
  id: string;
  name: string;
  /** Exactly 16 channel mappings (indices 0–15) */
  channels: ChannelMapping[];
  builtIn: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PresetsFile {
  version: number;
  activeId: string;
  presets: SbusPreset[];
}

/** SBUS switch position thresholds (172–1811 range, standard SBUS) */
export const SW_LOW = 682;   // below this = UP / low position
export const SW_HIGH = 1365; // above this = DOWN / high position

/** Candidate transmitter controls (hardcoded list) */
export const CONTROL_CANDIDATES: string[] = [
  // Sticks
  "J1", "J2", "J3", "J4",
  // 3-position switches
  "SA", "SB", "SC", "SD", "SE", "SG",
  // 2-position switch
  "SF",
  // Spring-return (momentary) switch
  "SH",
  // Knobs
  "LD", "RD",
  // Side levers
  "LS", "RS",
  // Trims
  "T1", "T2", "T3", "T4", "T5", "T6",
];

/** Default channel type for each control — used to auto-derive type on selection */
export const CONTROL_TYPE_MAP: Record<string, ChannelType> = {
  J1: "stick", J2: "stick", J3: "stick", J4: "stick",
  SA: "switch3", SB: "switch3", SC: "switch3", SD: "switch3", SE: "switch3", SG: "switch3",
  SF: "switch2",
  SH: "switchSpring",
  LD: "knob", RD: "knob",
  LS: "lever", RS: "lever",
  T1: "trim", T2: "trim", T3: "trim", T4: "trim", T5: "trim", T6: "trim",
};

/** Derive the channel type from a control name (falls back to unassigned) */
export function deriveControlType(control: string): ChannelType {
  return CONTROL_TYPE_MAP[control] ?? "unassigned";
}

/** Channel type labels for dropdowns */
export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  stick: "摇杆",
  switch2: "两档开关",
  switch3: "三档开关",
  switchSpring: "复位开关",
  knob: "旋钮",
  lever: "拨杆",
  trim: "微调",
  unassigned: "未分配",
};

/** Default label for an unassigned channel */
export function defaultMapping(index: number): ChannelMapping {
  return {
    label: `CH${String(index + 1).padStart(2, "0")}`,
    control: "",
    channelType: "unassigned",
  };
}

/** Build a fresh blank preset (all channels unassigned) */
export function blankPreset(name: string): SbusPreset {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    channels: Array.from({ length: 16 }, (_, i) => defaultMapping(i)),
    builtIn: false,
    createdAt: now,
    updatedAt: now,
  };
}
