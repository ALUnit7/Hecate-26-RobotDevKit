import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSbusStore } from "../stores/sbus-store";
import type { SbusData, SbusStats } from "../types/sbus";

export function useSbusData() {
  const setData = useSbusStore((s) => s.setData);
  const setStats = useSbusStore((s) => s.setStats);
  const setSignalLost = useSbusStore((s) => s.setSignalLost);
  const setConnected = useSbusStore((s) => s.setConnected);
  const setError = useSbusStore((s) => s.setError);

  useEffect(() => {
    const unlistenData = listen<SbusData>("sbus-data", (e) => setData(e.payload));
    const unlistenStats = listen<SbusStats>("sbus-stats", (e) => setStats(e.payload));
    const unlistenTimeout = listen("sbus-timeout", () => setSignalLost(true));
    const unlistenError = listen<string>("sbus-error", (e) => {
      setError(e.payload);
      setConnected(false);
    });

    return () => {
      unlistenData.then((fn) => fn());
      unlistenStats.then((fn) => fn());
      unlistenTimeout.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, [setData, setStats, setSignalLost, setConnected, setError]);
}
