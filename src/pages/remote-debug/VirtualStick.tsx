import { useSbusStore } from "../../stores/sbus-store";
import { usePresetStore } from "../../stores/preset-store";
import { CHANNEL_MID, CHANNEL_MIN, CHANNEL_MAX } from "../../types/sbus";
import { useI18n } from "../../i18n";

/** Normalize a raw 172–1811 channel value to -1..+1 (center 992 → 0) */
function toSigned(raw: number): number {
  const half = (CHANNEL_MAX - CHANNEL_MIN) / 2;
  return (raw - CHANNEL_MID) / half;
}

interface StickProps {
  /** Display label, e.g. "Left Stick" */
  label: string;
  /** Raw value of the X channel (172–1811, mid 992) */
  xRaw: number;
  /** Raw value of the Y channel (172–1811, mid 992) */
  yRaw: number;
  /** Control names for readout */
  xControl: string;
  yControl: string;
  /** Whether both channels are mapped */
  available: boolean;
  /** i18n string for "unmapped" label */
  unmappedLabel: string;
}

function Stick({ label, xRaw, yRaw, xControl, yControl, available, unmappedLabel }: StickProps) {
  const x = toSigned(xRaw); // -1 (left) .. +1 (right)
  const y = toSigned(yRaw); // -1 (down) .. +1 (up)

  // Map to position inside the square (5%..95% to keep the dot inside the border)
  const left = 50 + x * 45;
  // Screen Y is inverted: up (y=+1) → smaller top value
  const top = 50 - y * 45;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold text-zinc-300">{label}</span>
      <div className="relative w-32 h-32 bg-zinc-800/80 border border-zinc-700 rounded-lg overflow-hidden">
        {/* Crosshair lines */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-600/40" />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-600/40" />
        {/* Range circles */}
        <div className="absolute inset-2 border border-zinc-600/20 rounded-full" />
        {available ? (
          <div
            className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full bg-sky-400 border-2 border-sky-200/60 shadow-[0_0_8px_rgba(56,189,248,0.6)]"
            style={{ left: `${left}%`, top: `${top}%` }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] text-zinc-600">{unmappedLabel}</span>
          </div>
        )}
      </div>
      <div className="flex gap-3 text-[9px] text-zinc-500 font-mono">
        <span>{xControl}: <span className="text-zinc-300">{available ? xRaw : "—"}</span></span>
        <span>{yControl}: <span className="text-zinc-300">{available ? yRaw : "—"}</span></span>
      </div>
    </div>
  );
}

/** Dual virtual joystick panel. Left stick: X=J4, Y=J3. Right stick: X=J1, Y=J2. */
export function VirtualStick() {
  const { t } = useI18n();
  const channels = useSbusStore((s) => s.data.channels);
  const presetStore = usePresetStore();

  // Resolve channel indices for each control from the active preset
  const idxJ1 = presetStore.presets
    .find((p) => p.id === presetStore.activeId)
    ?.channels.findIndex((c) => c.control === "J1") ?? -1;
  const idxJ2 = presetStore.presets
    .find((p) => p.id === presetStore.activeId)
    ?.channels.findIndex((c) => c.control === "J2") ?? -1;
  const idxJ3 = presetStore.presets
    .find((p) => p.id === presetStore.activeId)
    ?.channels.findIndex((c) => c.control === "J3") ?? -1;
  const idxJ4 = presetStore.presets
    .find((p) => p.id === presetStore.activeId)
    ?.channels.findIndex((c) => c.control === "J4") ?? -1;

  const leftAvailable = idxJ3 >= 0 && idxJ4 >= 0;
  const rightAvailable = idxJ1 >= 0 && idxJ2 >= 0;

  const j3 = idxJ3 >= 0 ? channels[idxJ3] : CHANNEL_MID;
  const j4 = idxJ4 >= 0 ? channels[idxJ4] : CHANNEL_MID;
  const j1 = idxJ1 >= 0 ? channels[idxJ1] : CHANNEL_MID;
  const j2 = idxJ2 >= 0 ? channels[idxJ2] : CHANNEL_MID;

  const unmappedLabel = t("stick.unmapped");

  return (
    <div className="flex items-center justify-around bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4">
      <Stick
        label={t("stick.left")}
        xRaw={j4}
        yRaw={j3}
        xControl="J4 (X)"
        yControl="J3 (Y)"
        available={leftAvailable}
        unmappedLabel={unmappedLabel}
      />
      <Stick
        label={t("stick.right")}
        xRaw={j1}
        yRaw={j2}
        xControl="J1 (X)"
        yControl="J2 (Y)"
        available={rightAvailable}
        unmappedLabel={unmappedLabel}
      />
    </div>
  );
}
