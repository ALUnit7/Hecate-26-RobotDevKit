/** Matches Rust RecorderStatus struct in src-tauri/src/recorder.rs */
export interface RecorderStatus {
  recording: boolean;
  path: string | null;
  elapsed_secs: number;
  imu_count: number;
  motor_count: number;
  sbus_count: number;
}

export const RECORDER_IDLE: RecorderStatus = {
  recording: false,
  path: null,
  elapsed_secs: 0,
  imu_count: 0,
  motor_count: 0,
  sbus_count: 0,
};

/** Format elapsed seconds as MM:SS */
export function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Sum of all recorded frames across sources */
export function totalFrames(s: RecorderStatus): number {
  return s.imu_count + s.motor_count + s.sbus_count;
}
