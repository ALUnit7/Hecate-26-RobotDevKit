# Hecate-26 RobotDevKit (H26RDK)

**中文** | [English](./README.en.md)

跨平台 (Windows / Linux) 机器人调试工具套件，基于 **Tauri v2 + React 19 + TypeScript + Rust** 构建。最初为**舵轮机器人**开发，同时适用于任何电机驱动的机器人平台。

目前包含两个核心模块：
- **IMU 调试** — HiPNUC HI12 系列 9 轴 IMU 实时可视化
- **电机调试** — **灵足时代 RS00** 系列 CAN 伺服电机控制与诊断

![Platform](https://img.shields.io/badge/platform-Windows%20|%20Linux-blue)
![Framework](https://img.shields.io/badge/framework-Tauri%20v2-orange)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen)

---

## 为什么选择 H26RDK 调试 RS00 电机？

市面上大多数 CAN 电机调试工具需要 **USB-CAN 适配器 (CAN 盒)** 和厂商专用的 Windows 软件。H26RDK 采用了不同的方案：

| 特性 | H26RDK | 传统工具 |
|------|--------|---------|
| **CAN 接口** | 以太网网关 (Waveshare CAN-TO-ETH) — 免驱动，即插即用 | USB-CAN 适配器 — 需安装专有驱动 |
| **平台支持** | **Windows + Linux** 双平台 | 仅 Windows |
| **CAN ID 未知？** | **全范围扫描 (0~127)** — 自动发现并自动连接 | 必须预先知道 CAN ID |
| **协议切换** | MIT ↔ 私有协议**无需断开连接**即可切换 | 通常锁定在单一协议模式 |
| **MIT + 私有共存** | 在 MIT 控制的同时读取私有协议参数 — 互不冲突 | 官方上位机在 MIT 模式下可能拒绝连接 |
| **远程修改 CAN ID** | 软件端修改电机 CAN ID，自动保存至 Flash | 需物理接触或单独工具 |
| **开源** | 完全开源，可自由定制 | 闭源 |

---

## 界面截图

### 首页
![首页](docs/homepage.png)

### IMU 调试
![IMU 调试](docs/screenshot.png)

### 电机型号选择
![电机选择](docs/motor-select.png)

### RS00 电机调试
![RS00 调试](docs/rs00-debug.png)

---

## 功能概览

### IMU 调试模块

| 功能 | 说明 |
|------|------|
| 串口连接 | 自动枚举串口，自动识别 CP210x (VID:10C4 PID:EA60)，支持 4800~921600 波特率 |
| 协议解析 | Rust 后端实时解析 HiPNUC 二进制协议 (HI91)，CRC16 校验 |
| 数据仪表盘 | 加速度、角速度、磁场、欧拉角、四元数、温度、气压实时数值显示 |
| 实时图表 | uPlot 高性能滚动曲线 — 加速度/角速度/磁场/欧拉角四视图切换 |
| 3D 姿态 | Three.js 四元数驱动姿态可视化，ROS 坐标系 (Z 轴朝上) |
| AT 命令控制台 | 发送 AT 命令 (LOG ENABLE/DISABLE、波特率配置、固件查询等) |

### 电机调试模块 (灵足时代 RS00)

| 功能 | 说明 |
|------|------|
| **网关化 CAN 通信** | 通过 Waveshare 2-CH CAN-TO-ETH 网关以 UDP 透传 — 无需 USB-CAN 适配器 |
| **CAN ID 自动扫描** | 全范围扫描 (0~127)，**自动发现并自动连接** CAN ID 未知的电机 |
| **MIT 协议控制** | 位置/速度/力矩混合控制，Kp/Kd 增益实时滑块调节 |
| **私有协议控制** | 位置 / 速度 / 电流(力矩) / 阻抗 / 位置-速度 多模式切换，支持自动上报 |
| **协议自由切换** | MIT ↔ 私有协议模式在线切换，无需断开连接 |
| **实时反馈图表** | 角度、速度、力矩三通道滚动波形图 |
| **CAN 帧日志** | 实时 TX/RX CAN 帧查看器，支持暂停与清空 |
| **参数管理** | 读写电机参数 (限流/限速/PID/滤波增益/加速度等) |
| **Flash 保存/恢复** | 保存参数至 Flash、恢复出厂设置 |
| **远程修改 CAN ID** | 软件端修改电机 CAN ID，自动保存 Flash 并同步后端配置 |
| **设备诊断** | 读取 MCU Device ID (96-bit 唯一标识) 和固件版本号 |

---

## 快速开始

### 使用预编译版本 (Windows)

1. 从 [Releases](https://github.com/ALUnit7/Hecate-26-RobotDevKit/releases) 下载最新版本
2. 运行 `.exe` 安装包或直接运行便携版可执行文件
3. **IMU 模块**: 安装 [CP210x USB-UART 驱动](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
4. **电机模块**: 连接 [Waveshare 2-CH CAN-TO-ETH](https://www.waveshare.com/2-ch-can-to-eth.htm) 网关至局域网
5. Windows 10 用户需安装 [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (Windows 11 已预装)

### 电机快速连接

1. 给 RS00 电机上电，连接至 CAN-TO-ETH 网关
2. 打开 H26RDK → 电机调试 → RS00
3. 输入网关 IP (默认 `192.168.0.7`) 和端口 (默认 `20001`)
4. 点击 **Connect** 连接
5. **不知道电机的 CAN ID？** 点击扫描按钮 (🔍) — H26RDK 扫描全部 128 个地址 (0~127)，**自动连接**发现的第一个电机
6. 在 MIT / Private 协议标签页之间切换，开始控制

---

## 从源码构建

### Windows

**前置依赖：**

```powershell
# 1. Node.js >= 20 LTS (https://nodejs.org/)
node --version

# 2. pnpm >= 9
npm install -g pnpm

# 3. Rust stable (https://rustup.rs/)
rustc --version

# 4. MSVC Build Tools — 勾选 "Desktop development with C++" 工作负载
#    (https://visualstudio.microsoft.com/visual-cpp-build-tools/)
```

**构建：**

```powershell
git clone https://github.com/ALUnit7/Hecate-26-RobotDevKit.git
cd Hecate-26-RobotDevKit
pnpm install
pnpm tauri build
```

构建产物：
- `src-tauri/target/release/hecate26-robot-devkit.exe` — 可执行文件
- `src-tauri/target/release/bundle/nsis/*-setup.exe` — NSIS 安装包
- `src-tauri/target/release/bundle/msi/*.msi` — MSI 安装包

### Linux (Ubuntu / Debian)

**1. 安装系统依赖：**

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

> `libudev-dev` — `serialport` Rust crate 的必需依赖
> `libwebkit2gtk-4.1-dev` — Tauri v2 在 Linux 上的 WebView 后端

**2. 安装 Node.js (>= 20 LTS)：**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

**3. 安装 pnpm：**

```bash
npm install -g pnpm
```

**4. 安装 Rust：**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

**5. 克隆并构建：**

```bash
git clone https://github.com/ALUnit7/Hecate-26-RobotDevKit.git
cd Hecate-26-RobotDevKit
pnpm install
pnpm tauri build
```

构建产物 (位于 `src-tauri/target/release/bundle/`)：
- `deb/*.deb` — Debian 包
- `appimage/*.AppImage` — 通用 Linux 可执行包
- `rpm/*.rpm` — RPM 包 (如适用)

**开发模式** (前端热重载 + Rust 自动重编译)：

```bash
pnpm tauri dev
```

---

## 技术架构

```
┌──────────────────────────────────────────────────────────────┐
│                     React 19 Frontend                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │   首页   │  │IMU 调试  │  │电机选择  │  │ RS00 调试    │ │
│  │ (路由)   │  │ (串口)   │  │ (选择)   │  │ (UDP/CAN)    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│               Zustand Store + 60fps RAF 节流                 │
└──────────────────────────┬───────────────────────────────────┘
                           │ Tauri IPC 事件
┌──────────────────────────┴───────────────────────────────────┐
│                       Rust 后端                              │
│  serial.rs (USB-UART)    │  udp.rs (UDP → CAN 网关)         │
│  ├─ 枚举 / 打开 / 关闭  │  ├─ 连接 / 断开                  │
│  ├─ 读取线程             │  ├─ MIT / 私有协议               │
│  └─ AT 命令              │  ├─ 参数读写 / 保存              │
│                          │  ├─ CAN ID 扫描 (0~127)          │
│  protocol.rs (HiPNUC)   │  └─ Device ID / 固件版本查询     │
│  ├─ CRC16-CCITT          │                                   │
│  ├─ HI91 解码            │  motor_protocol.rs               │
│  └─ 状态机               │  ├─ MIT 帧编解码                 │
│                          │  ├─ 私有协议帧                    │
│  state.rs                │  └─ 参数定义表                    │
│  └─ 共享状态             │                                   │
└──────────────────────────┴───────────────────────────────────┘
        │                              │
  USB-UART (CP210x)         UDP (Waveshare CAN-TO-ETH)
        │                              │
   [ HI12 IMU ]             [ 灵足时代 RS00 电机 ]
```

| 层级 | 技术 | 用途 |
|------|------|------|
| 桌面框架 | Tauri v2 | 原生窗口、Rust 后端、IPC 通信 |
| 前端框架 | React 19 + TypeScript | 组件化 UI + 路由 (react-router-dom) |
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
pnpm install          # 安装依赖
pnpm tauri dev        # 开发模式 (热重载)
pnpm tauri build      # 生产构建

cd src-tauri
cargo test            # 运行 Rust 单元测试 (21 个测试)
```

### 项目结构

```
src-tauri/src/
├── main.rs              # Tauri 入口
├── lib.rs               # 插件 + 命令注册
├── protocol.rs          # HiPNUC 协议解析 (CRC16, HI91, 单元测试)
├── serial.rs            # 串口管理
├── state.rs             # 共享状态
├── udp.rs               # UDP/CAN 通信 (MIT + 私有协议 + 参数 + 诊断)
└── motor_protocol.rs    # 电机协议定义 (MIT/私有帧, 参数表)

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
│   └── use-motor-data.ts               # 电机事件监听 + 反馈处理
├── components/
│   ├── layout/AppNavbar.tsx             # 顶部导航栏
│   ├── toolbar/ConnectionToolbar.tsx    # IMU 串口工具栏
│   ├── dashboard/DataDashboard.tsx      # IMU 数值仪表盘
│   ├── charts/RealtimeChart.tsx         # IMU 实时图表
│   ├── viewer3d/AttitudeViewer.tsx      # 3D 姿态可视化
│   ├── console/CommandConsole.tsx       # AT 命令控制台
│   └── motor/
│       ├── MotorToolbar.tsx             # 电机连接工具栏
│       ├── MotorControlPanel.tsx        # MIT / 私有协议控制面板
│       ├── MotorChart.tsx               # 电机反馈图表
│       ├── MotorParamsPanel.tsx         # 参数读写面板
│       └── MotorCanLog.tsx              # CAN 帧日志
└── types/
    ├── imu.ts                           # IMU 数据类型
    └── motor.ts                         # 电机数据类型
```

---

## 路线图

### 即将推出

- [ ] **MIT 高频示波器模式** — 高速 MIT 命令循环 + 实时波形采集，实现示波器级别的电机响应分析 (阶跃响应、频率扫描、PID 调参可视化)
- [ ] **原生协议控制** — 直接构造并发送原始 CAN 帧，支持底层寄存器访问和自定义协议实验
- [ ] **多电机联控** — 同一 CAN 总线上多电机同步控制与协调调度
- [ ] **数据录制与导出** — 录制电机反馈和 IMU 数据至 CSV/JSON 用于离线分析 (后端已实现，待 UI 接入)

### 规划中

- [ ] **串口响应回显** — AT 命令 ASCII 响应显示至控制台
- [ ] **断线重连** — USB 拔出检测 + 自动重连
- [ ] **0x3xxx 只读参数** — 完整参数读取支持 (需 RS00 固件 ≥ 0.0.3.5)
- [ ] **更多电机型号** — 扩展电机调试模块以支持更多 CAN 伺服电机
- [ ] **数据回放** — 导入录制的 CSV 在图表 / 3D 视图中回放
- [ ] **图表增强** — 暂停/恢复、Y 轴锁定、悬停提示、可配置时间窗口
- [ ] **macOS 支持** — 测试并验证 macOS 构建
- [ ] **国际化** — 中英文界面切换

---

## 许可证

MIT
