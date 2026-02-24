# HI12 Series IMU Debugging Tool

## Project Overview

A desktop debugging tool for HiPNUC HI12 series IMU (Inertial Measurement Unit), built with **Tauri v2 + React 19 + TypeScript**. The tool connects to HI12 via USB-UART serial port, parses binary protocol data in real-time, and provides visualization including real-time charts, 3D attitude display, and a command console.

**Status**: v0.1.0 released. Core features (serial connection, protocol parsing, real-time charts, 3D visualization, AT command console) are fully functional and tested with real HI12 hardware.

## Target Device

- **Device**: HiPNUC HI12 series IMU
- **Interface**: USB-to-UART via CP210x bridge chip (VID: 0x10C4, PID: 0xEA60)
- **Protocol**: HiPNUC binary protocol (packet type: **HI91 / 0x91**)
- **Default baud rate**: 115200 (configurable: 4800 ~ 921600)
- **Serial config**: 8 data bits, no parity, 1 stop bit (8N1), no flow control

## Technology Stack

| Layer              | Technology                  | Purpose                                      |
| ------------------ | --------------------------- | -------------------------------------------- |
| Desktop Framework  | Tauri v2                    | Native window, serial port access via Rust   |
| Frontend Framework | React 19 + TypeScript       | UI components                                |
| Build Tool         | Vite 7                      | Fast dev server and bundler                   |
| Styling            | Tailwind CSS v4             | Atomic CSS with dark theme                   |
| Charts             | uPlot                       | High-performance real-time time-series charts |
| 3D Visualization   | Three.js (react-three-fiber + drei) | IMU attitude rendering from quaternion data |
| State Management   | Zustand 5                   | Lightweight reactive store for IMU data      |
| Serial Port        | Rust `serialport` crate     | Native serial I/O in Tauri backend           |
| Protocol Parsing   | Rust (custom)               | Binary frame decoding, CRC16 validation      |

## Project Structure

```
HI12_Series_IMU_Debugging_Tool2/
├── CLAUDE.md                    # This file - project guide
├── README.md                    # User-facing documentation
├── docs/
│   └── screenshot.png           # Application screenshot
├── References/                  # Official HiPNUC SDK & examples (read-only, gitignored)
│   └── products-master/
├── imu_cum_cn.pdf              # HiPNUC IMU protocol manual (gitignored)
├── src-tauri/                  # Rust backend (Tauri v2)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── capabilities/
│   │   └── default.json        # Tauri v2 capability permissions
│   ├── src/
│   │   ├── main.rs             # Tauri entry point
│   │   ├── lib.rs              # Tauri setup, plugin + command registration
│   │   ├── serial.rs           # Serial port management (list/open/close/send/record)
│   │   ├── protocol.rs         # HiPNUC binary protocol parser (CRC16, HI91, unit tests)
│   │   └── state.rs            # Shared state (port handle, decoder, recording state)
│   └── icons/
├── src/                        # React frontend
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Root layout (toolbar + charts/3D + dashboard + console)
│   ├── App.css                 # Tailwind CSS v4 imports + dark theme + uPlot overrides
│   ├── lib/
│   │   └── utils.ts            # cn() utility (clsx + tailwind-merge)
│   ├── stores/
│   │   └── imu-store.ts        # Zustand store: latest data, history buffer, connection state
│   ├── hooks/
│   │   └── use-imu-data.ts     # Tauri event listener + 60fps RAF throttle + FPS counter
│   ├── components/
│   │   ├── toolbar/
│   │   │   └── ConnectionToolbar.tsx  # Port select, baud rate, connect/disconnect, status
│   │   ├── dashboard/
│   │   │   └── DataDashboard.tsx      # Numeric display (acc/gyr/mag/euler/quat/env)
│   │   ├── charts/
│   │   │   └── RealtimeChart.tsx      # uPlot with 4 tabs (acc/gyr/mag/euler)
│   │   ├── viewer3d/
│   │   │   └── AttitudeViewer.tsx     # 3D IMU model, ROS Z-up coordinate system
│   │   └── console/
│   │       └── CommandConsole.tsx     # AT command input + response log
│   └── types/
│       └── imu.ts              # ImuData and PortInfo TypeScript interfaces
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── .gitignore
```

## HiPNUC Binary Protocol Specification

### Frame Format

```
| Offset | Size | Field     | Description                              |
|--------|------|-----------|------------------------------------------|
| 0      | 1    | SYNC1     | 0x5A                                     |
| 1      | 1    | SYNC2     | 0xA5                                     |
| 2      | 2    | Length    | Payload length in bytes (little-endian)  |
| 4      | 2    | CRC16    | CRC-CCITT over bytes[0..3] + payload (LE)|
| 6      | N    | Payload   | One or more sub-packets (tagged)         |
```

- **Header size**: 6 bytes
- **Max frame size**: 512 bytes
- **CRC16**: CRC-CCITT, polynomial 0x1021, initial value 0
  - Computed over: `header[0..4] (sync1, sync2, length) + payload` (excludes CRC field itself)

### CRC16 Algorithm

```rust
fn crc16_update(crc: u16, data: &[u8]) -> u16 {
    let mut crc = crc;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            let temp = crc << 1;
            crc = if crc & 0x8000 != 0 { temp ^ 0x1021 } else { temp };
        }
    }
    crc
}
```

### Packet 0x91 (HI91) - Primary for HI12 Series

This is the **only packet type** the HI12 series IMU outputs. Total payload: **76 bytes**.

| Offset | Size | Field        | Type      | Unit        | Notes                      |
|--------|------|-------------|-----------|-------------|----------------------------|
| 0      | 1    | tag         | u8        | -           | Always 0x91                |
| 1      | 2    | main_status | u16 LE    | -           | Reserved status bits       |
| 3      | 1    | temperature | i8        | deg C       | Integer temperature        |
| 4      | 4    | air_pressure| f32 LE    | Pa          | Barometric pressure        |
| 8      | 4    | system_time | u32 LE    | ms          | Device uptime timestamp    |
| 12     | 12   | acc[3]      | f32x3 LE  | G           | Accelerometer X/Y/Z (1G = 9.80665 m/s^2) |
| 24     | 12   | gyr[3]      | f32x3 LE  | deg/s       | Gyroscope X/Y/Z           |
| 36     | 12   | mag[3]      | f32x3 LE  | uT          | Magnetometer X/Y/Z        |
| 48     | 4    | roll        | f32 LE    | deg         | Roll angle                 |
| 52     | 4    | pitch       | f32 LE    | deg         | Pitch angle                |
| 56     | 4    | yaw         | f32 LE    | deg         | Yaw angle                  |
| 60     | 16   | quat[4]     | f32x4 LE  | -           | Quaternion (w, x, y, z)   |

**HI12-specific notes**:
- HI12 is a 9-axis IMU (accelerometer + gyroscope + magnetometer) with attitude calculation
- HI12 does **NOT** have GNSS/INS, so it only outputs **0x91 (HI91)** packets
- Accelerometer raw values are in **G** (gravity units), multiply by 9.80665 for m/s^2
- All multi-byte values are **little-endian**
- All floats are **IEEE 754 single-precision (32-bit)**

### AT Command Protocol

Commands are ASCII strings terminated with `\r\n`. Send via serial port.

| Command                     | Description                          |
|-----------------------------|--------------------------------------|
| `LOG ENABLE\r\n`           | Start data streaming                 |
| `LOG DISABLE\r\n`          | Stop data streaming                  |
| `LOG VERSION\r\n`          | Query firmware version               |
| `LOG HI91 ONTIME <sec>\r\n`| Set HI91 output interval (e.g. 0.005 = 200Hz) |
| `SERIALCONFIG <baud>\r\n`  | Change baud rate                     |
| `SAVECONFIG\r\n`           | Save configuration to flash          |
| `REBOOT\r\n`               | Reboot device                        |

**Important**: Must send `LOG DISABLE` before sending configuration commands.

## Architecture & Data Flow

```
USB-UART (CP210x)
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Rust Backend (src-tauri/)                      │
│                                                 │
│  serial.rs                                      │
│  ├─ list_ports() → Vec<PortInfo>                │
│  ├─ open_port(name, baud) → spawns read thread  │
│  ├─ close_port() → stops thread, drops port     │
│  ├─ send_command(cmd) → writes ASCII + \r\n     │
│  ├─ start_recording(path) → CSV writer          │
│  └─ stop_recording() → flush + close            │
│       │                                         │
│       ▼ (spawned read thread, 256B buffer)      │
│  protocol.rs                                    │
│  ├─ byte-by-byte state machine                  │
│  ├─ frame sync (0x5A 0xA5)                      │
│  ├─ CRC16 validation                            │
│  └─ HI91 struct deserialization                 │
│       │                                         │
│       ▼ (Tauri event emit)                      │
│  "imu-data" event → JSON { acc, gyr, mag, ... } │
└────────┬────────────────────────────────────────┘
         │ Tauri IPC (event system)
         ▼
┌─────────────────────────────────────────────────┐
│  React Frontend (src/)                          │
│                                                 │
│  hooks/use-imu-data.ts                          │
│  ├─ listen("imu-data") subscription             │
│  ├─ buffers events, flushes at 60fps via RAF    │
│  └─ FPS counter (1s interval)                   │
│       │                                         │
│       ▼                                         │
│  stores/imu-store.ts (Zustand)                  │
│  ├─ latest: ImuData (current frame)             │
│  ├─ history: ImuData[] (ring buffer, 600 pts)   │
│  ├─ timestamps: number[] (for chart X axis)     │
│  ├─ connected / portName / baudRate             │
│  ├─ recording / fps                             │
│  └─ consoleLines: {type, text}[]                │
│       │                                         │
│       ▼                                         │
│  UI Components                                  │
│  ├─ ConnectionToolbar (port/baud/connect/status)│
│  ├─ DataDashboard (6-column numeric display)    │
│  ├─ RealtimeChart (uPlot, 4 tab views)         │
│  ├─ AttitudeViewer (3D, ROS Z-up, quaternion)  │
│  └─ CommandConsole (AT command I/O)             │
└─────────────────────────────────────────────────┘
```

## Development Commands

```bash
# Install frontend dependencies
pnpm install

# Dev mode (frontend hot-reload + Rust auto-recompile)
pnpm tauri dev

# Build production release (exe + MSI + NSIS installer)
pnpm tauri build

# Run Rust unit tests (protocol parser)
cd src-tauri && cargo test

# Frontend-only build
pnpm build
```

## Key Implementation Details

### Protocol Parser (Rust) — `src-tauri/src/protocol.rs`
- Byte-by-byte state machine: `WaitSync1 → WaitSync2 → ReadHeader → ReadPayload → Validate`
- CRC16 computed over `buf[0..4] + buf[6..6+len]` (header sans CRC + payload)
- 4 unit tests verified: `test_crc16`, `test_parse_hi91_frame`, `test_resync_after_garbage`, `test_crc_mismatch_rejected`
- Reference implementation: `References/products-master/products-master/drivers/hipnuc_dec.c`

### Serial Port (Rust) — `src-tauri/src/serial.rs`
- Port enumeration with USB VID/PID for CP210x auto-detection
- Background read thread with `Arc<AtomicBool>` for clean shutdown
- Port cloned via `try_clone()` — read thread gets one copy, main thread keeps another for writes
- 100ms read timeout, 256-byte buffer
- CSV recording via `start_recording` / `stop_recording` commands (backend ready, UI not yet wired)

### Frontend Performance
- **60fps throttle**: IMU streams at 100-400Hz, `use-imu-data.ts` buffers via `useRef` and flushes at 60fps using `requestAnimationFrame`
- **uPlot**: Float64Array data arrays updated in-place, `uPlot.setData()` called on each render
- **History ring buffer**: 600 data points (10 seconds at 60fps), oldest data dropped
- **FPS counter**: 1-second interval counter displayed in toolbar

### 3D Visualization — `src/components/viewer3d/AttitudeViewer.tsx`
- **ROS coordinate system**: Z-axis up. A `ROS_TO_THREE` quaternion (-90° around X axis) converts to Three.js Y-up
- **IMU model**: Flat box `[2.4, 1.6, 0.4]` — large XY footprint, thin in Z (local Z maps to visual height after transform)
- **Quaternion-driven**: `ROS_TO_THREE.multiply(imuQuat)` — no gimbal lock
- **Red arrow**: Points along X+ (device forward direction)
- **Axis labels**: X(red), Y(green), Z(blue) with text labels

## What's NOT Implemented Yet (TODO)

See `README.md` for the full prioritized TODO list. Key items:
- **Data recording UI** — Backend `start_recording`/`stop_recording` commands exist, need toolbar button + file dialog
- **Serial response display** — AT command responses not yet routed back to console (need `serial-response` event)
- **Disconnect detection** — No USB unplug detection or auto-reconnect
- **Error statistics** — CRC failure count, frame drop rate not tracked

## Environment Requirements

1. **Node.js** >= 20 LTS
2. **pnpm** >= 9
3. **Rust** (stable, >= 1.75)
4. **MSVC Build Tools** (Windows: "Desktop development with C++" workload)
5. **WebView2 Runtime** (pre-installed on Windows 11)
6. **CP210x USB-UART driver** — from [Silicon Labs](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)

## Reference Materials

- `References/products-master/products-master/drivers/hipnuc_dec.c` — C protocol decoder (reference)
- `References/products-master/products-master/examples/python/parsers/hipnuc_serial_parser.py` — Python parser
- `imu_cum_cn.pdf` — Full HiPNUC IMU communication protocol manual (Chinese)
