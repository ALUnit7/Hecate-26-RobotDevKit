import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useImuStore } from "../../stores/imu-store";

export function CommandConsole() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const connected = useImuStore((s) => s.connected);
  const consoleLines = useImuStore((s) => s.consoleLines);
  const addConsoleLine = useImuStore((s) => s.addConsoleLine);

  useEffect(() => {
    const unlisten = listen<string>("serial-response", (event) => {
      addConsoleLine(`< ${event.payload}`);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [addConsoleLine]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleLines]);

  const handleSend = async () => {
    const cmd = input.trim();
    if (!cmd || !connected) return;

    addConsoleLine(`> ${cmd}`);
    setInput("");

    try {
      await invoke("send_command", { command: cmd });
    } catch (e) {
      addConsoleLine(`[ERROR] ${String(e)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full border-t border-zinc-800">
      <div className="px-3 py-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/80">
        Command Console
      </div>
      {/* Output area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed min-h-0"
      >
        {consoleLines.length === 0 ? (
          <span className="text-zinc-600">
            Type AT commands (e.g. LOG VERSION, LOG ENABLE)
          </span>
        ) : (
          consoleLines.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith(">")
                  ? "text-cyan-400"
                  : line.startsWith("[ERROR]")
                  ? "text-red-400"
                  : "text-zinc-300"
              }
            >
              {line}
            </div>
          ))
        )}
      </div>
      {/* Input area */}
      <div className="flex gap-2 px-3 py-2 border-t border-zinc-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!connected}
          placeholder={connected ? "Enter command..." : "Connect first"}
          className="flex-1 h-7 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 placeholder:text-zinc-600"
        />
        <button
          onClick={handleSend}
          disabled={!connected || !input.trim()}
          className="h-7 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
