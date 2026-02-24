# HI12 Series IMU Debugging Tool

## Project Overview

A desktop debugging tool for HiPNUC HI12 series IMU (Inertial Measurement Unit), built with **Tauri v2 + React + TypeScript**. The tool connects to HI12 via USB-UART serial port, parses binary protocol data in real-time, and provides visualization including real-time charts, 3D attitude display, and a command console.

## Target Device

- **Device**: HiPNUC HI12 series IMU
- **Interface**: USB-to-UART via CP210x bridge chip
- **Protocol**: HiPNUC binary protocol (primary packet type: **HI91**)
- **Default baud rate**: 115200 (configurable: 4800 ~ 921600)
- **Serial config**: 8 data bits, no parity, 1 stop bit (8N1), no flow control

## Technology Stack

| Layer              | Technology                  | Purpose                                      |
| ------------------ | --------------------------- | -------------------------------------------- |
| Desktop Framework  | Tauri v2                    | Native window, serial port access via Rust   |
| Frontend Framework | React 18 + TypeScript       | UI components                                |
| Build Tool         | Vite                        | Fast dev server and bundler                   |
| UI Components      | Shadcn/ui + Tailwind CSS v4 | Modern, customizable component library       |
| Charts             | uPlot                       | High-performance real-time time-series charts |
| 3D Visualization   | Three.js (react-three-fiber)| IMU attitude rendering from quaternion data  |
| State Management   | Zustand                     | Lightweight reactive store for IMU data      |
| Serial Port        | Rust `serialport` crate     | Native serial I/O in Tauri backend           |
| Protocol Parsing   | Rust (custom)               | Binary frame decoding, CRC16 validation      |

## Project Structure

```
HI12_Series_IMU_Debugging_Tool2/
├── CLAUDE.md                    # This file - project guide
├── References/                  # Official HiPNUC SDK & examples (read-only reference)
│   └── products-master/
├── imu_cum_cn.pdf              # HiPNUC IMU communication protocol manual
├── src-tauri/                  # Rust backend (Tauri v2)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json        # Tauri v2 capability permissions
│   ├── src/
│   │   ├── main.rs             # Tauri entry point
│   │   ├── lib.rs              # Tauri setup, plugin registration, command registration
│   │   ├── serial.rs           # Serial port management (open/close/list/write)
│   │   ├── protocol.rs         # HiPNUC binary protocol parser (CRC16, HI91/HI81/HI83)
│   │   └── state.rs            # Shared application state (serial port handle, connection status)
│   └── icons/
├── src/                        # React frontend
│   ├── main.tsx                # React entry + Tauri event listeners
│   ├── App.tsx                 # Root layout
│   ├── app.css                 # Global styles (Tailwind)
│   ├── lib/
│   │   └── utils.ts            # Shadcn/ui cn() utility
│   ├── stores/
│   │   └── imu-store.ts        # Zustand store: IMU data, connection state, history buffer
│   ├── hooks/
│   │   └── use-imu-data.ts     # Custom hook: subscribe to Tauri IMU events, throttle to 60fps
│   ├── components/
│   │   ├── ui/                 # Shadcn/ui base components (button, select, card, etc.)
│   │   ├── toolbar/
│   │   │   └── ConnectionToolbar.tsx  # Port selector, baud rate, connect/disconnect, record
│   │   ├── dashboard/
│   │   │   └── DataDashboard.tsx      # Numeric data table (acc/gyr/mag/euler/quat/temp)
│   │   ├── charts/
│   │   │   └── RealtimeChart.tsx      # uPlot time-series chart with tab switching
│   │   ├── viewer3d/
│   │   │   └── AttitudeViewer.tsx     # 3D IMU attitude visualization (react-three-fiber)
│   │   └── console/
│   │       └── CommandConsole.tsx     # AT command input + response display
│   └── types/
│       └── imu.ts              # TypeScript type definitions for IMU data
├── components.json             # Shadcn/ui configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json
├── vite.config.ts
├── package.json
└── index.html
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
- HI81 (INS) and HI83 (flexible bitmap) are for other product lines (HI81, HI226, etc.) - we implement parsing for completeness but HI12 will not produce them
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

Response: ASCII text containing "OK" on success.

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
│  ├─ open_port(name, baud) → Result              │
│  ├─ close_port() → Result                       │
│  └─ send_command(cmd) → Result                  │
│       │                                         │
│       ▼ (spawned read thread)                   │
│  protocol.rs                                    │
│  ├─ byte-by-byte state machine                  │
│  ├─ frame sync (0x5A 0xA5)                      │
│  ├─ CRC16 validation                            │
│  └─ HI91 struct deserialization                 │
│       │                                         │
│       ▼ (Tauri event emit)                      │
│  "imu-data" event → JSON { type, acc, gyr, ... }│
└────────┬────────────────────────────────────────┘
         │ Tauri IPC (event system)
         ▼
┌─────────────────────────────────────────────────┐
│  React Frontend (src/)                          │
│                                                 │
│  hooks/use-imu-data.ts                          │
│  ├─ listen("imu-data") subscription             │
│  ├─ throttle to 60fps for UI rendering          │
│  └─ accumulate history buffer (last N samples)  │
│       │                                         │
│       ▼                                         │
│  stores/imu-store.ts (Zustand)                  │
│  ├─ latest: ImuData (current frame)             │
│  ├─ history: ImuData[] (ring buffer, ~600 pts)  │
│  ├─ connected: boolean                          │
│  ├─ portName: string                            │
│  └─ recording: boolean                          │
│       │                                         │
│       ▼                                         │
│  UI Components                                  │
│  ├─ ConnectionToolbar (port/baud/connect)       │
│  ├─ DataDashboard (numeric values)              │
│  ├─ RealtimeChart (uPlot, acc/gyr/mag tabs)     │
│  ├─ AttitudeViewer (3D quaternion visualization) │
│  └─ CommandConsole (AT command I/O)             │
└─────────────────────────────────────────────────┘
```

### Data Flow Details

1. **Rust read thread**: After `open_port()`, a background thread continuously reads bytes from the serial port and feeds them into the protocol parser one byte at a time
2. **Protocol parser**: State machine that syncs on `0x5A 0xA5`, accumulates frame bytes, validates CRC16, and deserializes the HI91 payload into a typed struct
3. **Event emit**: Each successfully parsed frame is serialized to JSON and emitted as a Tauri event `"imu-data"`
4. **Frontend throttle**: The React hook receives all events but only updates the Zustand store at 60fps using `requestAnimationFrame`, dropping intermediate frames for smooth rendering
5. **History buffer**: A ring buffer of ~600 data points (10 seconds at 60fps) is maintained for chart rendering
6. **Command path**: User types AT commands in the console → `invoke("send_command")` → Rust writes bytes to serial port → response bytes are emitted as `"serial-response"` event

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [Port ▼] [Baud ▼] [Connect] [Record] [Status indicator]    │
├─────────────────────────────────┬────────────────────────────┤
│                                 │                            │
│   Real-time Charts              │   3D Attitude Viewer       │
│   [Acc] [Gyr] [Mag] [Euler]    │   (IMU cube rotating       │
│   uPlot scrolling graph         │    per quaternion data)    │
│   X/Y/Z channels overlaid      │                            │
│                                 │                            │
├─────────────────────────────────┴────────────────────────────┤
│  Data Dashboard                                              │
│  ┌──────────┬──────────┬──────────┬────────┬──────┬───────┐  │
│  │ Acc(m/s2)│ Gyr(d/s) │ Mag(uT)  │ Euler  │ Quat │ Env   │  │
│  │ X: 0.12  │ X: 0.03  │ X: 23.1  │ R:1.2° │ w:.99│ T:25° │  │
│  │ Y:-0.05  │ Y:-0.01  │ Y:-15.4  │ P:0.8° │ x:.01│ P:101 │  │
│  │ Z: 9.81  │ Z: 0.02  │ Z: 42.7  │ Y:45°  │ y:.00│ kPa   │  │
│  └──────────┴──────────┴──────────┴────────┴──────┴───────┘  │
├──────────────────────────────────────────────────────────────┤
│  Command Console                                             │
│  > LOG VERSION                                               │
│  < HI12 v2.1 OK                                             │
│  > [input field]                                    [Send]   │
└──────────────────────────────────────────────────────────────┘
```

- **Dark theme** by default (engineering tool convention)
- **Responsive** left-right split: charts 60%, 3D viewer 40%
- Dashboard shows converted units: acc in m/s^2 (raw G * 9.80665)

## Development Commands

```bash
# Install frontend dependencies
pnpm install

# Dev mode (frontend + Tauri backend hot-reload)
pnpm tauri dev

# Build production release
pnpm tauri build

# Add Shadcn/ui components
pnpm dlx shadcn@latest add button card select tabs input
```

## Key Implementation Notes

### Protocol Parser (Rust)
- Byte-by-byte state machine matching the reference C implementation in `drivers/hipnuc_dec.c`
- States: `WaitSync1 → WaitSync2 → ReadHeader → ReadPayload → Validate`
- CRC16 computed over `buf[0..4] + buf[6..6+len]` (header sans CRC + payload)
- Must handle partial reads and buffer accumulation correctly
- Reference Python parser: `References/products-master/products-master/examples/python/parsers/hipnuc_serial_parser.py`

### Serial Port (Rust)
- Use `serialport` crate with `available_ports()` for port enumeration
- Filter by `UsbPort` type with VID/PID matching CP210x (VID: 0x10C4, PID: 0xEA60) for auto-detection
- Read thread uses `port.read()` in a loop with small buffer (256 bytes)
- Thread must be cleanly stoppable via `Arc<AtomicBool>` flag when disconnecting

### Frontend Performance
- **60fps throttle**: The IMU may stream at 100-400Hz. Frontend only renders at 60fps max
- **uPlot**: Handles thousands of points efficiently; update data arrays in-place, call `uPlot.setData()`
- **Ring buffer**: Fixed-size array with head pointer, avoids array allocation churn
- **React memoization**: Chart and 3D components should use `React.memo` to avoid unnecessary re-renders

### Data Recording
- Record button toggles recording state
- Rust backend writes raw parsed data to CSV file with timestamp
- Columns: `timestamp_ms, acc_x, acc_y, acc_z, gyr_x, gyr_y, gyr_z, mag_x, mag_y, mag_z, roll, pitch, yaw, qw, qx, qy, qz, temp, pressure`

## Environment Requirements

The following must be installed before development:

1. **Node.js** >= 20 LTS — https://nodejs.org/
2. **pnpm** >= 9 — `npm install -g pnpm` (after installing Node.js)
3. **Rust** (stable) — https://rustup.rs/
4. **Tauri v2 prerequisites** (Windows):
   - Microsoft Visual Studio C++ Build Tools (with "Desktop development with C++" workload)
   - WebView2 (pre-installed on Windows 11)
   - See: https://v2.tauri.app/start/prerequisites/
5. **CP210x USB-UART driver** — Located in `References/products-master/products-master/usb_uart_drivers/win/`

## Reference Materials

- `References/products-master/products-master/drivers/hipnuc_dec.h` — Protocol structs and constants
- `References/products-master/products-master/drivers/hipnuc_dec.c` — C protocol decoder (reference implementation)
- `References/products-master/products-master/examples/python/parsers/hipnuc_serial_parser.py` — Python parser (reference)
- `References/products-master/products-master/examples/python/commands/read_data.py` — Python serial read example
- `imu_cum_cn.pdf` — Full HiPNUC IMU communication protocol manual (Chinese)
