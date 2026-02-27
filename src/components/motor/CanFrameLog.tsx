import { useRef, useEffect, useState } from "react";
import { useMotorStore } from "../../stores/motor-store";

export function CanFrameLog() {
  const canLog = useMotorStore((s) => s.canLog);
  const clearCanLog = useMotorStore((s) => s.clearCanLog);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [canLog]);

  const formatHex = (data: number[]) =>
    data.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");

  const formatId = (id: number, isExt: boolean) =>
    "0x" + id.toString(16).toUpperCase().padStart(isExt ? 8 : 3, "0");

  // Reconstruct the 13-byte Waveshare frame for display
  const buildRawFrame = (entry: { can_id: number; is_extended: boolean; data: number[] }) => {
    const dlc = entry.data.length;
    const frameInfo = (entry.is_extended ? 0x80 : 0x00) | (dlc & 0x0F);
    const id = entry.can_id;
    const bytes = [
      frameInfo,
      (id >> 24) & 0xFF,
      (id >> 16) & 0xFF,
      (id >> 8) & 0xFF,
      id & 0xFF,
      ...entry.data.slice(0, 8),
    ];
    while (bytes.length < 13) bytes.push(0);
    return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
  };

  return (
    <div className="flex flex-col h-full border-t border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <span className="text-[10px] text-zinc-500 font-medium">
          CAN Frame Log ({canLog.length})
        </span>
        <div className="flex gap-2">
          <button
            className={`text-[10px] transition-colors ${showRaw ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"}`}
            onClick={() => setShowRaw(!showRaw)}
            title="Show raw 13-byte Waveshare frame"
          >
            {showRaw ? "Raw ON" : "Raw"}
          </button>
          <button
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            onClick={clearCanLog}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-[10px] leading-4 px-2 py-1"
      >
        {canLog.length === 0 ? (
          <p className="text-zinc-600 py-2 text-center">
            No CAN frames yet. Connect and send commands.
          </p>
        ) : (
          canLog.map((entry, i) => (
            <div key={i}>
              <div
                className={`flex gap-2 ${
                  entry.direction === "tx" ? "text-cyan-400" : "text-zinc-400"
                }`}
              >
                <span className="text-zinc-600 w-20 shrink-0">
                  {new Date(entry.timestamp_ms).toLocaleTimeString([], {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="w-6 shrink-0 font-bold">
                  {entry.direction === "tx" ? "TX" : "RX"}
                </span>
                {entry.is_extended && (
                  <span className="text-amber-500 w-8 shrink-0">EXT</span>
                )}
                <span className={`${entry.is_extended ? "w-24" : "w-14"} shrink-0`}>
                  {formatId(entry.can_id, entry.is_extended)}
                </span>
                <span>{formatHex(entry.data)}</span>
              </div>
              {showRaw && (
                <div className="text-zinc-600 ml-[6.5rem] text-[9px]">
                  [{buildRawFrame(entry)}]
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
