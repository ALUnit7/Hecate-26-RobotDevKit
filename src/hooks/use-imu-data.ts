import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ImuData } from "../types/imu";
import { useImuStore } from "../stores/imu-store";

export function useImuData() {
  const pushData = useImuStore((s) => s.pushData);
  const incrementFrameCount = useImuStore((s) => s.incrementFrameCount);
  const setFps = useImuStore((s) => s.setFps);

  const pendingData = useRef<ImuData | null>(null);
  const rafId = useRef<number>(0);
  const fpsInterval = useRef<ReturnType<typeof setInterval>>(undefined);
  const frameCountRef = useRef(0);

  useEffect(() => {
    // Listen to imu-data events from Rust backend
    const unlisten = listen<ImuData>("imu-data", (event) => {
      // Buffer the latest data; only push to store at 60fps
      pendingData.current = event.payload;
      frameCountRef.current++;
    });

    // 60fps render loop
    const tick = () => {
      if (pendingData.current) {
        pushData(pendingData.current);
        incrementFrameCount();
        pendingData.current = null;
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    // FPS counter - update every second
    fpsInterval.current = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      unlisten.then((fn) => fn());
      cancelAnimationFrame(rafId.current);
      clearInterval(fpsInterval.current);
    };
  }, [pushData, incrementFrameCount, setFps]);
}
