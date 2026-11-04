/// SBUS decoded frame data (matches Rust SbusData struct in src-tauri/src/sbus.rs)
export interface SbusData {
  /** 16 channels, raw value 0–2047 (mid = 1024, per C++ reference implementation) */
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

/** SBUS channel value ranges — matches C++ reference: channels_.fill(2048) init,
 *  actual live range is 0–2047, nominal mid ~1024 */
export const CHANNEL_MIN = 0;
export const CHANNEL_MID = 1024;
export const CHANNEL_MAX = 2047;
export const CHANNEL_RANGE = CHANNEL_MAX - CHANNEL_MIN;

/** Normalize a raw channel value to 0..1 */
export function normalizeChannel(raw: number): number {
  return Math.max(0, Math.min(1, raw / CHANNEL_RANGE));
}
