import { useEffect, useRef } from "react";
import { usePlaybackStore, type PlaybackEntry } from "../stores/playback-store";
import { useImuStore } from "../stores/imu-store";
import { useMotorStore } from "../stores/motor-store";
import { useSbusStore } from "../stores/sbus-store";
import type { ImuData } from "../types/imu";
import type { MotorFeedback, PrivateFeedback } from "../types/motor";
import type { SbusData } from "../types/sbus";

/**
 * Drives the playback timeline via requestAnimationFrame.
 * Dispatches entries whose `t` has elapsed into the matching store,
 * mirroring the live data path so charts/3D/dashboards render identically.
 *
 * Mount this hook ONCE at the app root (inside App).
 */
export function usePlayback() {
  const state = usePlaybackStore((s) => s.state);
  const entries = usePlaybackStore((s) => s.entries);
  const position = usePlaybackStore((s) => s.position);
  const speed = usePlaybackStore((s) => s.speed);
  const advance = usePlaybackStore((s) => s._advance);

  // Cursor into the entries array; reset when entries or position jump backward
  const cursor = useRef(0);

  useEffect(() => {
    // Reset cursor when loading new entries or seeking to start
    cursor.current = 0;
  }, [entries]);

  useEffect(() => {
    if (position < (entries[cursor.current]?.t ?? Infinity)) {
      // Seeked backward — resync cursor to first entry at/after position
      let i = 0;
      while (i < entries.length && entries[i].t < position) i++;
      cursor.current = i;
    }
  }, [position, entries]);

  useEffect(() => {
    if (state !== "playing") return;

    // Grab store actions once per play session
    const imuPush = useImuStore.getState().pushData;
    const motorPush = useMotorStore.getState().pushFeedback;
    const sbusSet = useSbusStore.getState().setData;

    let lastTs = performance.now();
    let rafId = 0;

    const dispatchEntry = (e: PlaybackEntry) => {
      switch (e.src) {
        case "imu": {
          const d: ImuData = {
            acc: e.acc, gyr: e.gyr, mag: e.mag,
            roll: e.roll, pitch: e.pitch, yaw: e.yaw,
            quat: e.quat, temperature: e.temperature,
            air_pressure: e.air_pressure, system_time: e.system_time,
          };
          imuPush(d);
          break;
        }
        case "motor": {
          const d: MotorFeedback = {
            motor_id: e.motor_id, angle: e.angle,
            velocity: e.velocity, torque: e.torque, temperature: e.temperature,
          };
          motorPush(d);
          break;
        }
        case "motor_private": {
          const d: PrivateFeedback = {
            motor_id: e.motor_id, mode_status: e.mode_status,
            fault_bits: e.fault_bits, angle: e.angle,
            velocity: e.velocity, torque: e.torque, temperature: e.temperature,
          };
          // Also push the unified MotorFeedback so chart/dashboard update
          motorPush({
            motor_id: d.motor_id, angle: d.angle, velocity: d.velocity,
            torque: d.torque, temperature: d.temperature,
          });
          // Set private feedback on active motor
          useMotorStore.getState().setPrivateFeedback(d);
          break;
        }
        case "sbus": {
          const d: SbusData = {
            channels: e.channels, ch17: e.ch17, ch18: e.ch18,
            frame_lost: e.frame_lost, failsafe: e.failsafe,
          };
          sbusSet(d);
          break;
        }
      }
    };

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      advance(dt);
      const pos = usePlaybackStore.getState().position;

      // Dispatch all entries whose t <= pos (catch-up burst)
      const ents = usePlaybackStore.getState().entries;
      while (cursor.current < ents.length && ents[cursor.current].t <= pos) {
        dispatchEntry(ents[cursor.current]);
        cursor.current++;
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [state, advance]);

  // Keep speed referenced to avoid stale closure if changed mid-play
  useEffect(() => { void speed; }, [speed]);
}
