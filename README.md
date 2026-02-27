# Hecate-26 RobotDevKit (H26RDK)

多功能桌面机器人调试工具套件，基于 **Tauri v2 + React 19 + TypeScript + Rust** 构建。集成 IMU 调试和电机调试两大模块，通过统一的现代化界面进行实时数据可视化与设备控制。

![Platform](https://img.shields.io/badge/platform-Windows%20|%20Linux-blue)
![Framework](https://img.shields.io/badge/framework-Tauri%20v2-orange)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen)

## 目录

- [功能概览](#功能概览)
- [界面截图](#界面截图)
- [快速开始](#快速开始)
- [IMU 调试模块](#imu-调试模块)
- [电机调试模块](#电机调试模块)
- [从源码构建](#从源码构建)
  - [Windows](#windows)
  - [Linux](#linux)
- [技术架构](#技术架构)
- [开发指南](#开发指南)
- [TODO](#todo)
- [许可证](#许可证)

---

## 功能概览

| 模块 | 功能 | 说明 |
|------|------|------|
| **首页** | 模块选择 | 卡片式导航，选择 IMU 调试或电机调试模块 |
| **IMU 调试** | 串口连接 | 自动枚举串口，自动识别 CP210x 设备，支持 4800~921600 波特率 |
| | 协议解析 | Rust 后端实时解析 HiPNUC 二进制协议 (HI91)，CRC16 校验 |
| | 数据仪表盘 | 加速度、角速度、磁场、欧拉角、四元数、温度、气压实时数值显示 |
| | 实时图表 | uPlot 高性能滚动曲线，加速度/角速度/磁场/欧拉角四视图切换 |
| | 3D 姿态 | Three.js 四元数驱动姿态可视化，ROS 坐标系 (Z 轴朝上) |
| | AT 命令控制台 | 发送 AT 命令控制设备 (LOG ENABLE/DISABLE、配置波特率等) |
| **电机调试** | UDP/CAN 网关连接 | 通过 Waveshare 2-CH CAN-TO-ETH 网关连接 CAN 总线电机 |
| | MIT 协议控制 | 位置/速度/力矩混合控制模式，5 参数滑块实时调节 |
| | 私有协议控制 | RS00 私有协议：位置/速度/力矩/阻抗/位置-速度模式切换 |
| | 实时反馈图表 | 角度、速度、力矩三通道滚动波形 |
| | CAN 帧日志 | 实时显示 TX/RX CAN 帧，支持暂停与清空 |
| | 参数管理 | 读写电机参数 (限流/限速/PID/滤波等)，保存至 Flash |
| | 设备诊断 | 获取 MCU Device ID、固件版本号、CAN ID 扫描 (0~127) |
| | CAN ID 设置 | 远程修改电机 CAN ID 并自动保存至 Flash |

---

## 界面截图

![HI12 IMU Debugger Screenshot](docs/screenshot.png)

---

## 快速开始

### 使用预编译版本

1. 从 [Releases](https://github.com/ALUnit7/Hecate-26-RobotDevKit/releases) 下载最新版本的安装包或可执行文件
2. **Windows**: 运行 `.exe` 安装包或直接运行便携版可执行文件
3. **驱动安装**:
   - IMU 模块需要 [CP210x USB-UART 驱动](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
   - 电机模块需要 [Waveshare CAN-TO-ETH 网关](https://www.waveshare.com/2-ch-can-to-eth.htm) 及其网络配置
4. **WebView2 Runtime**: Windows 11 已预装；Windows 10 请从 [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) 下载

---

## IMU 调试模块

支持 HiPNUC HI12 系列 9 轴 IMU (加速度计 + 陀螺仪 + 磁力计 + 姿态解算)。

### 设备连接

- 通过 USB-UART (CP210x, VID:10C4 PID:EA60) 连接
- 串口配置: 8N1，默认 115200 波特率
- 自动枚举并优先选中 CP210x 设备

### 数据显示

| 数据 | 字段 | 单位 |
|------|------|------|
| 加速度 | X / Y / Z | m/s² |
| 角速度 | X / Y / Z | °/s |
| 磁场 | X / Y / Z | uT |
| 欧拉角 | Roll / Pitch / Yaw | ° |
| 四元数 | w / x / y / z | — |
| 环境 | 温度 / 气压 / 时间 | °C / kPa / s |

### AT 命令

| 命令 | 功能 |
|------|------|
| `LOG ENABLE` | 开启数据输出 |
| `LOG DISABLE` | 停止数据输出 |
| `LOG VERSION` | 查询固件版本 |
| `LOG HI91 ONTIME <sec>` | 设置输出间隔 (如 0.005 = 200Hz) |
| `SERIALCONFIG <baud>` | 修改波特率 |
| `SAVECONFIG` | 保存配置到 Flash |

---

## 电机调试模块

支持 RS00 系列 CAN 总线伺服电机，通过 Waveshare 2-CH CAN-TO-ETH 网关进行 UDP 透传通信。

### 硬件连接

```
PC (UDP) ←→ Waveshare CAN-TO-ETH 网关 ←→ CAN 总线 ←→ RS00 电机
```

- 网关默认 IP: `192.168.0.7`，工作端口: `20001`
- CAN 波特率需在网关 Web 管理页面配置 (默认 1Mbps)
- 电机默认 CAN ID: `127` (0x7F)

### 控制模式

**MIT 协议** — 混合控制模式:
- 5 个参数滑块: Position / Velocity / Torque / Kp / Kd
- 请求-应答模式，发送命令时返回反馈

**私有协议** — 多模式控制:
- 位置模式 (Position)
- 速度模式 (Speed)
- 力矩模式 (Current/Torque)
- 阻抗模式 (Impedance)
- 位置-速度模式 (Position-Speed)
- 支持连续自动反馈 (Auto Report)

### 参数管理

- 读写 0x7xxx 索引空间的可读写参数 (限流/限速/PID/滤波/加速度等)
- 只读参数 (0x3xxx) 需固件 ≥ 0.0.3.5
- 保存参数至 Flash / 恢复出厂设置
- 远程修改 CAN ID (自动保存至 Flash)

### 诊断功能

- 获取 MCU Device ID (96-bit 唯一标识)
- 读取固件版本号
- CAN ID 全范围扫描 (0~127)

---

## 从源码构建

### Windows

**1. 安装 Node.js (>= 20 LTS)**

从 https://nodejs.org/ 下载安装。

```powershell
node --version   # v20.x 或更高
```

**2. 安装 pnpm (>= 9)**

```powershell
npm install -g pnpm
pnpm --version   # 9.x 或更高
```

**3. 安装 Rust (stable)**

从 https://rustup.rs/ 下载 `rustup-init.exe` 并运行。安装后重启终端。

```powershell
rustc --version   # 1.75+
cargo --version
```

**4. 安装 MSVC Build Tools**

- 下载 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- 勾选 **"Desktop development with C++"** 工作负载

**5. 克隆并构建**

```powershell
git clone https://github.com/ALUnit7/Hecate-26-RobotDevKit.git
cd Hecate-26-RobotDevKit
pnpm install
pnpm tauri build
```

构建产物:
- `src-tauri/target/release/hecate26-robot-devkit.exe` — 可执行文件
- `src-tauri/target/release/bundle/nsis/*-setup.exe` — NSIS 安装包
- `src-tauri/target/release/bundle/msi/*.msi` — MSI 安装包

### Linux

以 Ubuntu/Debian 为例 (其他发行版请替换对应包管理器命令):

**1. 安装系统依赖**

```bash
sudo apt update
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libwebkit2gtk-4.1-dev \
  libudev-dev \
  pkg-config
```

> `libudev-dev` 是串口 (`serialport` crate) 必需的依赖。
> `libwebkit2gtk-4.1-dev` 是 Tauri v2 在 Linux 上的 WebView 后端。

**2. 安装 Node.js (>= 20 LTS)**

```bash
# 使用 nvm (推荐)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node --version
```

**3. 安装 pnpm**

```bash
npm install -g pnpm
pnpm --version
```

**4. 安装 Rust**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version
cargo --version
```

**5. 克隆并构建**

```bash
git clone https://github.com/ALUnit7/Hecate-26-RobotDevKit.git
cd Hecate-26-RobotDevKit
pnpm install
pnpm tauri build
```

构建产物 (位于 `src-tauri/target/release/bundle/`):
- `deb/*.deb` — Debian 包
- `appimage/*.AppImage` — 通用 Linux 可执行包
- `rpm/*.rpm` — RPM 包 (如适用)

**开发模式** (前端热重载 + Rust 自动重编译):

```bash
pnpm tauri dev
```

---

## 技术架构

```
┌──────────────────────────────────────────────────────────────┐
│                     React 19 Frontend                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ HomePage │  │IMU Debug │  │Motor Sel │  │ RS00 Debug   │ │
│  │ (cards)  │  │ (serial) │  │ (select) │  │ (UDP/CAN)    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│               Zustand Store + 60fps RAF Throttle             │
└──────────────────────────┬───────────────────────────────────┘
                           │ Tauri IPC Events
┌──────────────────────────┴───────────────────────────────────┐
│                       Rust Backend                           │
│  serial.rs (USB-UART)    │  udp.rs (UDP/CAN gateway)        │
│  ├─ list/open/close      │  ├─ connect/disconnect            │
│  ├─ read thread          │  ├─ MIT/Private protocol          │
│  └─ AT commands          │  ├─ param read/write              │
│                          │  ├─ scan/diagnose                 │
│  protocol.rs (HiPNUC)   │  └─ CAN frame log                │
│  ├─ CRC16-CCITT          │                                   │
│  ├─ HI91 frame decode    │  motor_protocol.rs               │
│  └─ state machine        │  ├─ MIT frame encode/decode       │
│                          │  ├─ Private protocol frames       │
│  state.rs                │  └─ param definitions             │
│  └─ shared state         │                                   │
└──────────────────────────┴───────────────────────────────────┘
        │                              │
  USB-UART (CP210x)         UDP (Waveshare CAN-ETH)
        │                              │
   [ HI12 IMU ]              [ RS00 CAN Motor ]
```

| 层级 | 技术 | 用途 |
|------|------|------|
| 桌面框架 | Tauri v2 | 原生窗口、Rust 后端、IPC 通信 |
| 前端框架 | React 19 + TypeScript | UI 组件化 + 路由 (react-router-dom) |
| 构建工具 | Vite 7 | 开发服务器 + 生产构建 |
| 样式 | Tailwind CSS v4 | 原子化 CSS + 暗色主题 |
| 图表 | uPlot | 高性能实时时序图 |
| 3D | Three.js + react-three-fiber | 四元数姿态可视化 |
| 状态管理 | Zustand 5 | 轻量级响应式状态 |
| 串口 | Rust `serialport` crate | 原生串口 I/O |
| 网络 | Rust `std::net::UdpSocket` | UDP 透传 CAN 帧 |

---

## 开发指南

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm tauri dev

# 运行 Rust 单元测试 (21 个测试)
cd src-tauri && cargo test

# 仅构建前端
pnpm build

# 完整生产构建
pnpm tauri build
```

### 项目结构

```
src-tauri/src/
├── main.rs              # Tauri 入口
├── lib.rs               # 插件注册 + 全部命令注册
├── protocol.rs          # HiPNUC 协议解析 (CRC16 + HI91 + 单元测试)
├── serial.rs            # 串口管理 (枚举/打开/关闭/读取线程/AT 命令)
├── state.rs             # 共享状态 (串口句柄/解码器/录制)
├── udp.rs               # UDP/CAN 通信 (MIT + 私有协议 + 参数 + 诊断)
└── motor_protocol.rs    # 电机协议定义 (MIT 帧/私有帧/参数表)

src/
├── main.tsx             # 路由配置
├── App.tsx              # 根布局 + 导航栏
├── pages/
│   ├── HomePage.tsx                     # 模块选择首页
│   ├── imu-debug/ImuDebugPage.tsx       # IMU 调试页
│   └── motor-debug/
│       ├── MotorSelectPage.tsx          # 电机型号选择
│       └── rs00/RS00DebugPage.tsx       # RS00 电机调试页
├── stores/
│   ├── imu-store.ts                     # IMU 状态管理
│   └── motor-store.ts                   # 电机状态管理
├── hooks/
│   ├── use-imu-data.ts                  # IMU 事件监听 + 60fps 节流
│   └── use-motor-data.ts                # 电机事件监听 + 反馈处理
├── components/
│   ├── layout/AppNavbar.tsx             # 顶部导航栏
│   ├── toolbar/ConnectionToolbar.tsx    # IMU 串口工具栏
│   ├── dashboard/DataDashboard.tsx      # IMU 数值仪表盘
│   ├── charts/RealtimeChart.tsx         # IMU 实时图表
│   ├── viewer3d/AttitudeViewer.tsx      # 3D 姿态可视化
│   ├── console/CommandConsole.tsx       # AT 命令控制台
│   └── motor/
│       ├── MotorToolbar.tsx             # 电机连接工具栏
│       ├── MotorControlPanel.tsx        # MIT/私有协议控制面板
│       ├── MotorChart.tsx               # 电机反馈图表
│       ├── MotorParamsPanel.tsx         # 参数读写面板
│       └── MotorCanLog.tsx              # CAN 帧日志
└── types/
    ├── imu.ts                           # IMU 数据类型
    └── motor.ts                         # 电机数据类型
```

---

## TODO

- [ ] 数据录制功能 — CSV 导出 (后端已实现，需 UI 接入)
- [ ] 串口响应回显 — AT 命令 ASCII 响应显示
- [ ] 断线重连 — USB 拔出检测 + 自动重连
- [ ] 数据回放 — 导入 CSV 回放
- [ ] 图表增强 — 暂停/恢复、Y 轴锁定、悬停提示
- [ ] 多设备支持 — 同时连接多个设备
- [ ] 0x3xxx 只读参数 — 待官方固件 ≥ 0.0.3.5 后完整支持
- [ ] 更多电机型号 — 扩展至其他 CAN 总线伺服电机
- [ ] 跨平台测试 — macOS / Linux 验证
- [ ] 国际化 — 中英文界面切换

---

## 许可证

MIT
