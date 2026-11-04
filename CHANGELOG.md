# Changelog

All notable changes to Hecate-26 RobotDevKit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-11-04

### Added
- **SBUS Remote Debugger**: Real-time visualization of SBUS RC receiver channel data
  - 16-channel horizontal bars with center marker and raw value readout
  - Digital channels CH17/CH18 status indicators
  - Frame-lost & failsafe status badges
  - Live stats: bytes received, valid frames, invalid frames, lost frames
  - Signal-loss detection (>500ms without frames)
  - Stick channels (CH1-4) highlighted in sky blue, auxiliary channels in emerald

### Technical
- New Rust backend module `sbus.rs`: byte-stream SBUS decoder, background read thread, Tauri commands `sbus_open_port` / `sbus_close_port`
- Port opened in 8N2 mode (matches NCAS reference config), configurable baud (100000/115200/200000)
- Frame sync trusts 0x0F header + fixed 25-byte stride (no footer validation — many receivers use non-zero end byte)
- Frontend: `use-sbus-data` hook, `sbus-store` (Zustand), `RemoteDebugPage`
- Route `/remote-debug` added, tool card on HomePage

### Changed
- Channel range normalized to 0–2047 (mid 1024) to match C++ reference implementation
- Version bumped to 1.2.0 (Cargo.toml, tauri.conf.json, HomePage footer)

## [1.1.1] - 2026-03-12

### Fixed
- **CAN log throttle**: Rust-side 500 frames/s rate limiting prevents UI stutter on busy CAN bus
- **Port auto-sync**: Changing gateway port now automatically syncs local bind port
- **HI12 IMU reference**: Corrected protocol documentation references in CLAUDE.md

### Documentation
- Updated README version badge and roadmap
- Improved architecture diagrams

## [1.1.0] - 2026-02-28

### Added
- **Multi-motor support**: Discover and control multiple motors on same CAN bus with independent state tracking
- **MIT high-frequency control loop**: Dedicated Rust thread for 50~2000Hz MIT command streaming
- **Batch commands**: Enable all / Stop all / Zero all / Set mode all / Clear faults all
- Real-time parameter updates from frontend sliders to background MIT loop

### Changed
- Motor feedback processing moved to dedicated thread for better performance
- CAN frame log UI optimized with batched updates via RAF

## [1.0.0] - 2026-02-27

### Added
- **RS00 Motor Debugging Module**: Complete motor control and diagnostics interface
  - Waveshare CAN-TO-ETH gateway integration (UDP transparent mode)
  - Full-range CAN ID scanning (0~127) with auto-discovery and auto-connect
  - MIT protocol control (position/velocity/torque hybrid, Kp/Kd gain tuning)
  - Private protocol control (position/velocity/current/impedance/position-velocity modes)
  - Online protocol switching (MIT ↔ Private) without disconnecting
  - Real-time feedback charts (angle, velocity, torque)
  - CAN frame log viewer with pause/clear
  - Parameter read/write/save to Flash/factory reset
  - Remote CAN ID modification with auto-save and backend sync
  - Device diagnostics (MCU Device ID, firmware version)
- Motor selection page with RS00 card
- Motor state management via Zustand
- UDP/CAN backend in Rust (`udp.rs`, `motor_protocol.rs`)

### Changed
- Project renamed from "HI12-IMU-Debugger" to "Hecate-26 RobotDevKit"
- Architecture upgraded to multi-tool platform
- Repository name: `hecate26-robot-devkit` (suggested)

### Documentation
- Added bilingual README (Chinese + English)
- Added screenshots (2x2 grid layout)
- Updated roadmap with motor module highlights

## [0.2.0] - 2026-02-24

### Added
- Multi-page architecture with `react-router-dom` v7
- HomePage with tool card grid (6 tools: IMU ready, 5 planned)
- AppNavbar with breadcrumb navigation and back/home buttons
- ImuDebugPage assembling all IMU components

### Changed
- Refactored from single-purpose IMU tool to extensible multi-tool platform
- All IMU components moved under `pages/imu-debug/`

### Documentation
- Added comprehensive CLAUDE.md with architecture and protocol specs
- Added Restore.md for session context
- Added screenshot and environment setup guide

## [0.1.0] - 2026-02-24

### Added
- Initial Tauri v2 + React 19 + TypeScript project structure
- HiPNUC binary protocol parser with CRC16-CCITT validation (4 unit tests)
- Serial port management with CP210x auto-detection
- Real-time IMU data visualization:
  - uPlot high-performance charts (acc/gyr/mag/euler with 600-point ring buffer)
  - Three.js 3D attitude viewer (quaternion-driven, ROS Z-up coordinate)
  - Data dashboard (9-axis sensor + temperature + pressure)
  - AT command console
- Connection toolbar with port enumeration and baud rate selection
- 60fps frontend throttle via RAF
- Zustand state management
- Cross-platform support (Windows + Linux)

### Technical
- Rust backend: `protocol.rs`, `serial.rs`, `state.rs`
- Frontend: Tailwind CSS v4, React 19, TypeScript
- Build system: Vite 7, Tauri CLI 2

[1.2.0]: https://github.com/ALUnit7/Hecate-26-RobotDevKit/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/ALUnit7/Hecate-26-RobotDevKit/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/ALUnit7/Hecate-26-RobotDevKit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ALUnit7/Hecate-26-RobotDevKit/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/ALUnit7/Hecate-26-RobotDevKit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ALUnit7/Hecate-26-RobotDevKit/releases/tag/v0.1.0
