# Session Restore Context

This document captures the full project state for quick context restoration in new Claude sessions.

## Project Identity

- **Name**: HI12 Series IMU Debugging Tool
- **Repository**: `ALUnit7/HI12-IMU-Debugger` (private, GitHub)
- **Version**: v0.1.0 (released with NSIS installer + portable exe)
- **Local path**: `G:\Tools\HI12_Series_IMU_Debugging_Tool2`
- **Stack**: Tauri v2 + React 19 + TypeScript + Rust backend
- **Purpose**: Desktop tool for HiPNUC HI12 IMU — serial connection, binary protocol parsing, real-time visualization

## What's Complete

### Rust Backend (src-tauri/src/)
All backend code is complete and tested:
- **protocol.rs**: HiPNUC binary protocol parser — CRC16-CCITT (poly 0x1021, init 0), byte-by-byte state machine (WaitSync1/WaitSync2/ReadHeader/ReadPayload/Validate), HI91 packet deserialization (76 bytes). 4 unit tests pass (`cargo test` in `src-tauri/`).
- **serial.rs**: Port enumeration with CP210x auto-detect (VID:10C4 PID:EA60), open/close with background read thread (`Arc<AtomicBool>` shutdown flag), AT command sending (`\r\n` terminated), CSV recording commands (start/stop).
- **state.rs**: `AppState` struct holding `Mutex<Option<Box<dyn SerialPort>>>`, `Arc<AtomicBool>` for read thread control, `Mutex<Decoder>`, and recording state.
- **lib.rs**: Tauri app setup with `env_logger::init()`, plugin registration (`opener`), 6 registered commands.
- **Cargo.toml**: Dependencies: tauri 2, serialport 4, serde 1, serde_json 1, log 0.4, env_logger 0.11.

### React Frontend (src/)
All UI components are complete and working:
- **types/imu.ts**: `ImuData` interface (acc/gyr/mag as `[number,number,number]`, roll/pitch/yaw, quat as `[number,number,number,number]`, temperature, air_pressure, system_time) and `PortInfo` interface.
- **stores/imu-store.ts**: Zustand store — `latest`, `history` (ring buffer, 600 pts), `timestamps`, connection state (connected/portName/baudRate), recording, fps, consoleLines.
- **hooks/use-imu-data.ts**: Listens to `"imu-data"` Tauri events, buffers in `useRef`, flushes to store at 60fps via `requestAnimationFrame`. FPS counter via 1-second interval.
- **ConnectionToolbar.tsx**: Port dropdown (auto-selects CP210x), baud rate select (4800-921600), connect/disconnect button, refresh button, green/red status indicator with FPS display.
- **DataDashboard.tsx**: 6-column grid showing Acc(m/s²), Gyr(°/s), Mag(uT), Euler(°), Quaternion, Environment(T/P/time). X=red, Y=green, Z=blue color coding.
- **RealtimeChart.tsx**: uPlot chart with 4 tabs (Accelerometer/Gyroscope/Magnetometer/Euler Angles). Float64Array data, ResizeObserver for auto-sizing, cursor disabled for performance.
- **AttitudeViewer.tsx**: Three.js 3D view with ROS Z-up coordinate system. `ROS_TO_THREE` quaternion (-90° X rotation) converts to Three.js Y-up. Flat box model `[2.4, 1.6, 0.4]`, red arrow for X+ forward, axis labels, orbit controls.
- **CommandConsole.tsx**: Text input + Send button, sends AT commands via `invoke("send_command")`, color-coded log (cyan=sent, white=received, red=error), auto-scroll.
- **App.tsx**: Root layout — toolbar at top, charts (60%) + 3D viewer (40%) in middle, dashboard below, command console (180px) at bottom.
- **App.css**: Tailwind CSS v4 imports, dark theme (zinc-900/950 backgrounds), uPlot legend styling, custom scrollbar.

### Configuration
- **tauri.conf.json**: Window 1280×800, min 960×600, title "HI12 IMU Debugger", CSP null (required for Three.js blob URLs).
- **capabilities/default.json**: Permissions for core, opener, and event system (emit/listen).
- **vite.config.ts**: React plugin + Tailwind CSS v4 plugin.
- **package.json**: React 19, Three.js 0.183, uPlot 1.6, Zustand 5, Tailwind CSS v4.

### Documentation & Release
- **README.md**: Full documentation with screenshot, environment setup guide, quick start, feature descriptions, AT command reference, architecture diagram, protocol spec, TODO list.
- **docs/screenshot.png**: Real application screenshot.
- **GitHub release v0.1.0**: NSIS installer + portable exe uploaded.
- **7 conventional commits**: feat(backend), test(protocol), feat(frontend), fix(3d), docs(readme), etc.

## What's NOT Done (TODO)

### High Priority
1. **Data recording UI** — `start_recording`/`stop_recording` Tauri commands exist in serial.rs but no toolbar Record button or file dialog integration (`@tauri-apps/plugin-dialog` needed).
2. **Serial response display** — AT command responses from device are not routed back to CommandConsole. Need to detect ASCII text vs binary frames in the read thread, emit `"serial-response"` events separately from `"imu-data"`.
3. **Disconnect detection** — No USB unplug handling. Need to detect serial errors in read thread, emit disconnect event, clean up state.
4. **Error statistics** — CRC failures and frame drops not tracked or displayed.

### Medium Priority
- Data replay from CSV
- Chart pause/resume, Y-axis lock, hover tooltips
- Adjustable chart time window (5s/10s/30s/60s)
- Multi-device support
- Quick command panel (preset AT command buttons)
- Light/dark theme toggle
- i18n (Chinese/English)

### Low Priority
- Firmware upgrade integration
- Allan variance analysis
- NMEA/HI81/HI83 protocol support
- Cross-platform (macOS/Linux)
- CAN bus support
- Additional export formats (JSON, ROS bag, MAT)

## Development Environment

### Tool Paths (this machine)
```bash
# Rust (custom install location)
export RUSTUP_HOME="F:/Programming/Environment/rust/.rustup"
export CARGO_HOME="F:/Programming/Environment/rust/.cargo"
export PATH="/f/Programming/Environment/rust/.cargo/bin:$PATH"

# Node.js + pnpm
export PATH="/c/Program Files/nodejs:/c/Users/14998/AppData/Roaming/npm:$PATH"

# GitHub CLI
export PATH="/f/Tools/GitHub CLI:$PATH"
```

### Build Commands
```bash
pnpm install              # Install frontend deps
pnpm tauri dev            # Dev mode (hot-reload)
pnpm tauri build          # Production build
cd src-tauri && cargo test # Run protocol parser tests
```

### Build Outputs
- `src-tauri/target/release/imu-app.exe` — Portable executable
- `src-tauri/target/release/bundle/nsis/*.exe` — NSIS installer
- `src-tauri/target/release/bundle/msi/*.msi` — MSI installer

## Protocol Quick Reference

**Frame**: `[0x5A][0xA5][len 2B LE][CRC16 2B LE][payload]`

**HI91 (76 bytes)**: tag(0x91) + main_status(u16) + temperature(i8) + air_pressure(f32) + system_time(u32) + acc[3](f32×3, in G) + gyr[3](f32×3, °/s) + mag[3](f32×3, uT) + roll/pitch/yaw(f32, °) + quat[4](f32×4, w/x/y/z)

**CRC16**: CRC-CCITT, poly 0x1021, init 0. Computed over `header[0..4] + payload` (excludes CRC field bytes 4-5).

## Key Design Decisions
1. **No Shadcn/ui**: Originally planned but not used. All UI is custom Tailwind CSS — simpler, fewer dependencies.
2. **No tailwind.config.ts**: Using Tailwind CSS v4 with `@tailwindcss/vite` plugin — config-free, CSS-first approach.
3. **ROS coordinate system**: Z-axis up in 3D view, matching robotics/IMU conventions. `ROS_TO_THREE` quaternion handles the conversion to Three.js Y-up internally.
4. **60fps throttle on frontend**: IMU can output 100-400Hz, but UI only renders at 60fps. Events are buffered and flushed via `requestAnimationFrame`.
5. **Flat box model**: 3D IMU representation is `[2.4, 1.6, 0.4]` — wide/long/thin, representing a PCB board shape.
6. **Acc in m/s²**: Raw protocol values are in G, frontend multiplies by 9.80665 for display.
