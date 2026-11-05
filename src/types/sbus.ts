/// SBUS decoded frame data (matches Rust SbusData struct in src-tauri/src/sbus.rs)
export interface SbusData {
  /** 16 channels, raw value 172–1811 (mid = 992, standard SBUS) */
  channels: number[];
  ch17: boolean;
  ch18: boolean;
  frame_lost: boolean;
  failsafe: boolean;
}

/// Periodic statistics emitted via "sbus-stats" (updated even with no valid frames)
export interface SbusStats {
  bytes_received: number;
  frames_received: number;
  frames_invalid: number;
  frames_lost: number;
}

/** SBUS channel value ranges — de facto SBUS standard: 172 (min) – 992 (mid) – 1811 (max).
 *  Real receivers output ~992 at stick rest (confirmed on hardware). */
export const CHANNEL_MIN = 172;
export const CHANNEL_MID = 992;
export const CHANNEL_MAX = 1811;
export const CHANNEL_RANGE = CHANNEL_MAX - CHANNEL_MIN; // 1639

/** Normalize a raw channel value to 0..1 */
export function normalizeChannel(raw: number): number {
  return Math.max(0, Math.min(1, (raw - CHANNEL_MIN) / CHANNEL_RANGE));
}
