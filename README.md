# HI12 Series IMU Debugging Tool

一款面向 HiPNUC HI12 系列惯性测量单元 (IMU) 的桌面调试工具，基于 **Tauri v2 + React + TypeScript** 构建。通过 USB-UART 串口连接 HI12 设备，实时解析二进制协议数据，并提供实时图表、3D 姿态可视化和 AT 命令控制台等功能。

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Framework](https://img.shields.io/badge/framework-Tauri%20v2-orange)
![License](https://img.shields.io/badge/license-MIT-green)

## 目录

- [功能概览](#功能概览)
- [界面截图](#界面截图)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [功能详细说明](#功能详细说明)
  - [设备连接](#设备连接)
  - [实时数据仪表盘](#实时数据仪表盘)
  - [实时图表](#实时图表)
  - [3D 姿态可视化](#3d-姿态可视化)
  - [AT 命令控制台](#at-命令控制台)
- [技术架构](#技术架构)
- [协议说明](#协议说明)
- [开发指南](#开发指南)
- [TODO](#todo)

---

## 功能概览

| 功能 | 说明 |
|------|------|
| **串口连接** | 自动枚举串口，自动识别 CP210x 设备，支持 4800~921600 波特率 |
| **协议解析** | Rust 后端实时解析 HiPNUC 二进制协议 (HI91)，CRC16 校验 |
| **数据仪表盘** | 数值面板展示加速度、角速度、磁场、欧拉角、四元数、温度、气压 |
| **实时图表** | uPlot 高性能滚动曲线，支持加速度/角速度/磁场/欧拉角四种视图切换 |
| **3D 姿态** | Three.js 渲染 IMU 姿态，四元数驱动，ROS 坐标系 (Z 轴朝上) |
| **命令控制台** | 发送 AT 命令 (LOG ENABLE/DISABLE、配置波特率、查询版本等) |
| **60fps 节流** | IMU 可输出 100~400Hz 数据，前端以 60fps 平滑渲染，不丢帧不卡顿 |

---

## 界面截图

![HI12 IMU Debugger Screenshot](docs/screenshot.png)

---

## 环境要求

### 运行 (使用预编译版本)

仅需以下环境即可直接运行已编译的程序：

| 依赖 | 说明 | 获取方式 |
|------|------|---------|
| **Windows 10/11** | x64 系统 | — |
| **WebView2 Runtime** | Tauri 渲染引擎 | Windows 11 已预装；Windows 10 请从 [Microsoft 官网](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) 下载安装 |
| **CP210x USB-UART 驱动** | HI12 设备使用 CP210x 芯片进行 USB 转串口通信 | 从 [Silicon Labs 官网](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) 下载，或使用本仓库 `References/` 目录下的离线安装包 |

### 开发环境配置

从源码构建需要安装以下工具链，请按顺序操作：

**1. 安装 Node.js (>= 20 LTS)**

从 https://nodejs.org/ 下载 LTS 版本安装。安装完成后验证：

```bash
node --version   # 应输出 v20.x 或更高
npm --version
```

**2. 安装 pnpm (>= 9)**

```bash
npm install -g pnpm
pnpm --version   # 应输出 9.x 或更高
```

**3. 安装 Rust (stable)**

从 https://rustup.rs/ 下载 `rustup-init.exe` 并运行，选择默认选项。安装完成后**重启终端**，然后验证：

```bash
rustc --version   # 应输出 1.75+ 版本
cargo --version
```

**4. 安装 Microsoft Visual Studio C++ Build Tools**

Rust 在 Windows 上编译需要 MSVC 工具链：

- 下载 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- 在安装程序中勾选 **"Desktop development with C++"** 工作负载
- 如果已安装 Visual Studio (任意版本)，确认该工作负载已启用即可

**5. 安装 CP210x 驱动**

HI12 设备通过 CP210x USB-UART 芯片连接电脑：

- 从 [Silicon Labs 官网](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) 下载并安装
- 安装后插入 HI12 设备，在设备管理器中应能看到 `Silicon Labs CP210x USB to UART Bridge (COMx)`

---

## 快速开始

### 方式一：直接运行预编译版本

1. 确保已安装 [CP210x 驱动](#运行-使用预编译版本) 和 WebView2 Runtime
2. 从 [Releases](https://github.com/ALUnit7/HI12-IMU-Debugger/releases) 下载安装包，或直接运行 `src-tauri/target/release/imu-app.exe`
3. 用 USB 数据线将 HI12 设备连接到电脑
4. 打开程序，在工具栏下拉列表中选择对应的 COM 端口 (程序会自动优先选中 CP210x 设备)
5. 波特率保持默认 `115200` (除非你已修改过设备波特率)
6. 点击 **Connect**，即可看到实时数据

> **提示**：如果连接后没有数据，在底部命令控制台输入 `LOG ENABLE` 并回车。

### 方式二：从源码构建

确保已完成上述[开发环境配置](#开发环境配置)，然后：

```bash
# 1. 克隆仓库
git clone https://github.com/ALUnit7/HI12-IMU-Debugger.git
cd HI12-IMU-Debugger

# 2. 安装前端依赖
pnpm install

# 3. 开发模式 (前端热重载 + Rust 自动重编译)
pnpm tauri dev

# 4. 生产构建 (生成可执行文件和安装包)
pnpm tauri build
```

构建产物：
- `src-tauri/target/release/imu-app.exe` — 可直接运行的程序
- `src-tauri/target/release/bundle/nsis/*.exe` — NSIS 安装包
- `src-tauri/target/release/bundle/msi/*.msi` — MSI 安装包

---

## 功能详细说明

### 设备连接

**工具栏位于窗口顶部**，从左到右依次为：

1. **端口选择** — 下拉列表显示所有可用串口，格式为 `COMx - USB VID:PID (设备名)`。程序自动识别 CP210x 芯片 (VID:10C4 PID:EA60) 并优先选中
2. **刷新按钮** (&#x21bb;) — 重新扫描串口列表（拔插设备后使用）
3. **波特率** — 下拉选择，默认 115200。支持: 4800 / 9600 / 19200 / 38400 / 57600 / **115200** / 230400 / 460800 / 921600
4. **Connect / Disconnect** — 连接或断开串口。连接后端口和波特率选择器锁定
5. **状态指示** — 绿色圆点 + 实时帧率 (fps)，或红色错误信息

**串口配置**: 8 数据位，无校验，1 停止位 (8N1)，无流控。

### 实时数据仪表盘

连接后，底部数据面板实时显示 6 组传感器数据：

| 分组 | 字段 | 单位 | 说明 |
|------|------|------|------|
| **Acc** | X / Y / Z | m/s² | 加速度（原始值为 G，已乘以 9.80665 转换） |
| **Gyr** | X / Y / Z | °/s | 角速度 |
| **Mag** | X / Y / Z | uT | 磁场强度 |
| **Euler** | Roll / Pitch / Yaw | ° | 欧拉角 |
| **Quat** | w / x / y / z | - | 四元数（归一化） |
| **Env** | Temperature / Pressure / Time | °C / kPa / s | 温度、气压、设备运行时间 |

X/Y/Z 分量用红/绿/蓝色标注，与图表和坐标轴颜色一致。

### 实时图表

中部左侧为 **uPlot** 实时滚动曲线图，包含 4 个可切换的 Tab 页：

| Tab | 显示内容 | Y 轴单位 |
|-----|---------|---------|
| **Accelerometer** | 加速度 X/Y/Z | m/s² |
| **Gyroscope** | 角速度 X/Y/Z | °/s |
| **Magnetometer** | 磁场 X/Y/Z | uT |
| **Euler Angles** | Roll/Pitch/Yaw | ° |

- 保留约 **600 个数据点** (60fps × 10 秒)，超出后最旧数据被丢弃
- 每条曲线使用不同颜色 (红/绿/蓝 或 橙/紫/青)
- 图表自适应容器大小，窗口缩放后自动调整

### 3D 姿态可视化

中部右侧为 **Three.js** 渲染的 3D 视图：

- **坐标系**: ROS 标准右手坐标系 — X(红色)前、Y(绿色)左、**Z(蓝色)朝上**
- **IMU 模型**: 扁平长方体 (模拟 PCB 板)，XY 平面投影面积大，Z 方向薄
- **姿态驱动**: 使用四元数 (w, x, y, z) 实时驱动模型旋转，无万向锁问题
- **前向标记**: 红色箭头指示 X+ 方向 (设备正前方)
- **交互**: 鼠标左键拖拽旋转视角，滚轮缩放
- **参考网格**: 地面网格辅助空间感知
- **欧拉角覆盖层**: 左下角显示当前 Roll / Pitch / Yaw 数值

### AT 命令控制台

底部为命令控制台，用于向设备发送 AT 指令：

**常用命令**:

| 命令 | 功能 | 示例 |
|------|------|------|
| `LOG ENABLE` | 开启数据输出流 | 连接后如无数据，发送此命令 |
| `LOG DISABLE` | 停止数据输出 | **修改配置前必须先发送** |
| `LOG VERSION` | 查询固件版本 | 返回版本号 + OK |
| `LOG HI91 ONTIME <秒>` | 设置 HI91 输出间隔 | `LOG HI91 ONTIME 0.005` = 200Hz |
| `SERIALCONFIG <波特率>` | 修改波特率 | `SERIALCONFIG 230400` |
| `SAVECONFIG` | 保存当前配置到 Flash | 修改配置后务必执行 |
| `REBOOT` | 重启设备 | — |

**使用方法**:
1. 在输入框输入命令
2. 按 **Enter** 或点击 **Send** 发送
3. 发送的命令显示为青色 `>`，设备响应显示为白色 `<`，错误为红色

**注意**: 修改配置参数 (波特率、输出频率等) 的步骤：
```
LOG DISABLE          ← 先停止输出
SERIALCONFIG 230400  ← 修改配置
SAVECONFIG           ← 保存到 Flash
REBOOT               ← 重启生效
```

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                         │
│  ConnectionToolbar │ RealtimeChart │ AttitudeViewer │ ...    │
│                    Zustand Store (60fps throttle)            │
└───────────────────────────┬─────────────────────────────────┘
                            │ Tauri IPC Events ("imu-data")
┌───────────────────────────┴─────────────────────────────────┐
│                      Rust Backend                           │
│  serial.rs           protocol.rs          state.rs          │
│  ├─ list_ports()     ├─ CRC16-CCITT       ├─ SerialPort     │
│  ├─ open_port()      ├─ Frame sync        ├─ AtomicBool     │
│  ├─ close_port()     ├─ HI91 decode       └─ Decoder        │
│  └─ send_command()   └─ State machine                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ USB-UART (CP210x, 115200 8N1)
                        [ HI12 IMU ]
```

| 层级 | 技术 | 用途 |
|------|------|------|
| 桌面框架 | Tauri v2 | 原生窗口、Rust 后端、IPC 通信 |
| 前端框架 | React 19 + TypeScript | UI 组件化 |
| 构建工具 | Vite 7 | 开发服务器 + 生产构建 |
| 样式 | Tailwind CSS v4 | 原子化 CSS + 暗色主题 |
| 图表 | uPlot | 高性能实时时序图 (万级数据点无压力) |
| 3D | Three.js + react-three-fiber | 四元数姿态可视化 |
| 状态管理 | Zustand | 轻量级响应式状态 |
| 串口 | Rust `serialport` crate | 原生串口 I/O |
| 协议解析 | Rust 自定义 | 逐字节状态机 + CRC16 校验 |

---

## 协议说明

HI12 系列 IMU 使用 HiPNUC 二进制协议，仅输出 **HI91 (0x91)** 数据包。

### 帧格式

```
┌──────┬──────┬───────────┬───────────┬──────────────┐
│ 0x5A │ 0xA5 │ Length(2B)│ CRC16(2B) │ Payload(NB)  │
│ SYNC1│ SYNC2│ LE        │ LE        │ HI91 data    │
└──────┴──────┴───────────┴───────────┴──────────────┘
```

- CRC16: CRC-CCITT (poly 0x1021, init 0)，计算范围: `header[0:4] + payload`

### HI91 数据包 (76 字节)

| 偏移 | 大小 | 字段 | 类型 | 单位 |
|------|------|------|------|------|
| 0 | 1 | tag | u8 | 固定 0x91 |
| 1 | 2 | main_status | u16 LE | — |
| 3 | 1 | temperature | i8 | °C |
| 4 | 4 | air_pressure | f32 LE | Pa |
| 8 | 4 | system_time | u32 LE | ms |
| 12 | 12 | acc[3] | f32×3 LE | G (×9.80665→m/s²) |
| 24 | 12 | gyr[3] | f32×3 LE | °/s |
| 36 | 12 | mag[3] | f32×3 LE | uT |
| 48 | 4 | roll | f32 LE | ° |
| 52 | 4 | pitch | f32 LE | ° |
| 56 | 4 | yaw | f32 LE | ° |
| 60 | 16 | quat[4] | f32×4 LE | w, x, y, z |

---

## 开发指南

```bash
# 安装依赖
pnpm install

# 开发模式 (前端热重载 + Rust 自动重编译)
pnpm tauri dev

# 仅运行 Rust 单元测试 (协议解析)
cd src-tauri && cargo test

# 仅构建前端
pnpm build

# 完整生产构建
pnpm tauri build
```

### 项目结构

```
src-tauri/src/
├── main.rs          # Tauri 入口
├── lib.rs           # 插件注册 + 命令注册
├── protocol.rs      # 协议解析 (CRC16 + HI91 + 单元测试)
├── serial.rs        # 串口管理 (枚举/打开/关闭/读取线程/命令发送)
└── state.rs         # 共享状态 (串口句柄/解码器/录制状态)

src/
├── App.tsx          # 根布局
├── App.css          # Tailwind + 暗色主题
├── types/imu.ts     # IMU 数据类型定义
├── stores/imu-store.ts          # Zustand 状态管理
├── hooks/use-imu-data.ts        # Tauri 事件监听 + 60fps 节流
└── components/
    ├── toolbar/ConnectionToolbar.tsx   # 连接工具栏
    ├── dashboard/DataDashboard.tsx     # 数值仪表盘
    ├── charts/RealtimeChart.tsx        # uPlot 实时图表
    ├── viewer3d/AttitudeViewer.tsx     # 3D 姿态可视化
    └── console/CommandConsole.tsx      # AT 命令控制台
```

---

## TODO

### 高优先级

- [ ] **数据录制功能** — 工具栏增加 Record 按钮，将解析后的数据导出为 CSV 文件 (后端已实现 `start_recording`/`stop_recording` 命令，需接入文件选择对话框 `@tauri-apps/plugin-dialog`)
- [ ] **串口响应显示** — 当前 AT 命令发送后设备的 ASCII 响应未回显到控制台，需在 Rust 读取线程中区分二进制数据帧和 ASCII 响应文本，分别通过 `imu-data` 和 `serial-response` 事件推送
- [ ] **断线重连** — 检测 USB 拔出事件，自动清理状态并提示用户；支持一键重连
- [ ] **错误统计** — 显示 CRC 校验失败次数、丢帧率等协议层统计信息

### 中优先级

- [ ] **数据回放** — 导入已录制的 CSV 文件，在图表和 3D 视图中回放
- [ ] **图表增强** — 支持暂停/恢复滚动、Y 轴范围手动锁定、数据点悬停提示
- [ ] **图表时间窗口** — 可调节显示窗口长度 (5s / 10s / 30s / 60s)
- [ ] **多设备支持** — 同时连接多个 HI12 设备，分 Tab 显示各自数据
- [ ] **快捷命令面板** — 预设常用 AT 命令按钮 (一键启动/停止输出、设置频率等)
- [ ] **主题切换** — 支持亮色/暗色主题切换
- [ ] **国际化** — 中英文界面切换

### 低优先级

- [ ] **固件升级** — 集成 HiPNUC 固件下载协议 (参考 `examples/C/fw_downloader/`)
- [ ] **Allan 方差分析** — 内置 Allan Variance 计算与绘图 (参考 `examples/matlab/allan/`)
- [ ] **NMEA 协议支持** — 解析 NMEA 语句 (GGA/RMC/SXT)，为扩展到 GNSS/INS 产品线做准备
- [ ] **HI81/HI83 包支持** — 完善 INS 和灵活位图包解析 (当前仅 HI91)，支持 HI226 等其他型号
- [ ] **跨平台** — 测试并支持 macOS / Linux 构建
- [ ] **CAN 总线支持** — 通过 SocketCAN 或 USB-CAN 适配器连接 CAN 总线设备
- [ ] **数据导出格式** — 除 CSV 外支持 JSON、ROS bag、MAT 格式导出
- [ ] **自动波特率检测** — 尝试不同波特率连接，自动识别设备当前配置
- [ ] **窗口布局自定义** — 支持拖拽调整图表/3D/仪表盘/控制台的分区大小
- [ ] **系统托盘** — 最小化到托盘，后台持续录制

---

## 参考资料

- [HiPNUC 官方示例仓库](https://github.com/hipnuc/products) — 驱动源码 + 多平台示例
- `References/products-master/` — 本项目内嵌的官方 SDK 副本
- `imu_cum_cn.pdf` — HiPNUC IMU 通信协议手册 (中文)
- `References/products-master/products-master/drivers/hipnuc_dec.c` — C 参考解码器
- `References/products-master/products-master/examples/python/parsers/hipnuc_serial_parser.py` — Python 参考解析器

## 许可证

MIT
