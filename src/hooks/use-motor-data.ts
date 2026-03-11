import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { MotorFeedback, CanFrameLog, FaultStatus, ParamReadResponse, PrivateFeedback } from "../types/motor";
import { useMotorStore } from "../stores/motor-store";

export function useMotorData() {
  const pushFeedback = useMotorStore((s) => s.pushFeedback);
  const pushCanLogBatch = useMotorStore((s) => s.pushCanLogBatch);
  const setFps = useMotorStore((s) => s.setFps);
  const setFaultStatus = useMotorStore((s) => s.setFaultStatus);
  const setParamValue = useMotorStore((s) => s.setParamValue);
  const setUdpWarning = useMotorStore((s) => s.setUdpWarning);
  const setDeviceInfo = useMotorStore((s) => s.setDeviceInfo);
  const setFirmwareVersion = useMotorStore((s) => s.setFirmwareVersion);
  const setPrivateFeedback = useMotorStore((s) => s.setPrivateFeedback);

  const pendingFb = useRef<MotorFeedback | null>(null);
  const pendingLogs = useRef<CanFrameLog[]>([]);
  const rafId = useRef<number>(0);
  const fpsInterval = useRef<ReturnType<typeof setInterval>>(undefined);
  const frameCountRef = useRef(0);

  useEffect(() => {
    const unlistenFb = listen<MotorFeedback>("motor-feedback", (event) => {
      pendingFb.current = event.payload;
      frameCountRef.current++;
    });

    // Batch CAN log entries — only flush in RAF tick
    const unlistenLog = listen<CanFrameLog>("can-frame-log", (event) => {
      pendingLogs.current.push(event.payload);
    });

    const unlistenFault = listen<FaultStatus>("motor-fault-status", (event) => {
      setFaultStatus(event.payload);
    });

    const unlistenParamRead = listen<ParamReadResponse>("motor-param-read", (event) => {
      setParamValue(event.payload);
    });

    const unlistenUdpWarning = listen<string>("udp-warning", (event) => {
      setUdpWarning(event.payload);
    });

    const unlistenDeviceInfo = listen<{ motor_id: number; device_id: string }>("motor-device-info", (event) => {
      setDeviceInfo(event.payload.motor_id, event.payload.device_id);
    });

    const unlistenVersionInfo = listen<{ motor_id: number; version: string }>("motor-version-info", (event) => {
      setFirmwareVersion(event.payload.motor_id, event.payload.version);
    });

    const unlistenPrivFb = listen<PrivateFeedback>("motor-private-feedback", (event) => {
      setPrivateFeedback(event.payload);
    });

    // 60fps render loop — flush feedback + CAN logs in batch
    const tick = () => {
      if (pendingFb.current) {
        pushFeedback(pendingFb.current);
        pendingFb.current = null;
      }
      if (pendingLogs.current.length > 0) {
        pushCanLogBatch(pendingLogs.current);
        pendingLogs.current = [];
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    // FPS counter
    fpsInterval.current = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      unlistenFb.then((fn) => fn());
      unlistenLog.then((fn) => fn());
      unlistenFault.then((fn) => fn());
      unlistenParamRead.then((fn) => fn());
      unlistenUdpWarning.then((fn) => fn());
      unlistenDeviceInfo.then((fn) => fn());
      unlistenVersionInfo.then((fn) => fn());
      unlistenPrivFb.then((fn) => fn());
      cancelAnimationFrame(rafId.current);
      clearInterval(fpsInterval.current);
    };
  }, [pushFeedback, pushCanLogBatch, setFps, setFaultStatus, setParamValue, setUdpWarning, setDeviceInfo, setFirmwareVersion, setPrivateFeedback]);
}
