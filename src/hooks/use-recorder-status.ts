import { useEffect, useRef } from "react";
import { useRecorderStore } from "../stores/recorder-store";

/**
 * Mounts a polling interval that refreshes recorder status every second
 * while recording is active. Safe to mount multiple times — each instance
 * manages its own interval independently.
 */
export function useRecorderStatus() {
  const { status, poll } = useRecorderStore();
  const polling = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (status.recording) {
      polling.current = setInterval(poll, 1000);
    } else {
      clearInterval(polling.current);
      polling.current = undefined;
    }
    return () => clearInterval(polling.current);
  }, [status.recording, poll]);

  return status;
}
