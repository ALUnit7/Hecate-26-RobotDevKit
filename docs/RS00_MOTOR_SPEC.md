# RobStride RS00 电机技术规格 (MIT 协议)

本文档整理自《RS00使用说明书260112.pdf》(v1.0, 2025-11-25)，面向 NCAS 集成开发。
重点关注 MIT 协议，同时包含非 MIT 但可能需要的指令和参数。

---

## 1. 电机基本参数

| 项目 | 数据 |
|------|------|
| 型号 | RobStride RS00 (准直驱一体化电机模组) |
| 厂商 | 北京市灵足时代科技有限公司 (RobStride Dynamics) |
| 额定电压 | 48 VDC |
| 电压范围 | 24V ~ 60 VDC |
| 额定负载扭矩 | 5 N.m |
| 峰值负载扭矩 | 14 N.m |
| 空载转速 | 315 rpm ±10% |
| 额定负载转速 | 100 rpm ±10% |
| 空载电流 | 0.5 Arms |
| 额定相电流 (峰值) | 4.7 Apk ±10% |
| 最大相电流 (峰值) | 15.5 Apk ±10% |
| 反电势 | 9.5 Vrms/kRPM ±10% |
| 转矩常数 (有效值) | 1.48 N.m/Arms |
| 重量 | 310g ±3g |
| 极数 | 28 极 (14 极对) |
| 相数 | 3 相 |
| 驱动方式 | FOC |
| **减速比** | **10:1** |
| 编码器分辨率 | 14-bit 单圈绝对值 (16384 counts/rev) |
| 绝缘等级 | Class B |
| 工作温度 | -20°C ~ 50°C |
| 存储温度 | -30°C ~ 70°C |
| 接口 | XT30PB(2+2)-M.G.B (VBAT+, GND, CAN-H, CAN-L) |

### 驱动器参数

| 项目 | 数据 |
|------|------|
| 额定工作电压 | 48 VDC |
| 允许最大电压 | 60 VDC |
| 额定工作相电流 | 4.7 Apk |
| 最大允许相电流 | 15.5 Apk |
| 待机功率 | ≤18mA |
| CAN 总线速率 | 1Mbps (默认) |
| 控制板允许最大温度 | 145°C |
| 尺寸 | Φ57mm |

---

## 2. 协议概述

RS00 支持三种 CAN 通信协议：

| 协议 | CAN 帧类型 | CAN ID 位宽 | 默认 |
|------|-----------|-----------|------|
| 私有协议 | 扩展帧 | 29-bit | 是 (出厂默认) |
| CANopen | 标准帧 | 11-bit | 否 |
| **MIT 协议** | **标准帧** | **11-bit** | **否 (需切换)** |

**切换到 MIT 协议**: 通过私有协议通信类型 25、或 MIT 指令 8 切换，**需重新上电生效**。

---

## 3. CAN ID 配置

### 3.1 默认值

| 参数 | 功能码 | 类型 | 范围 | 默认值 |
|------|-------|------|------|--------|
| CAN_ID (电机 ID) | 0x200A | uint8 | 0 ~ 127 | **1** |
| CAN_MASTER (主机 ID) | 0x200B | uint8 | 0 ~ 127 | **0** |

### 3.2 修改方式

1. **上位机软件**: 直接输入新 ID
2. **MIT 指令 7**: 修改电机 CAN ID (详见 §5.8)
3. **MIT 指令 9**: 修改主机 CAN ID (详见 §5.10)
4. **私有协议类型 18**: 写参数 0x200A / 0x200B

---

## 4. MIT 协议帧格式

### 4.1 CAN 帧基本格式

- CAN 2.0 **标准帧 (11-bit ID)**
- 波特率: 1Mbps (默认，可通过私有协议修改)
- 数据长度: 8 字节

### 4.2 11-bit CAN ID 编码

```
┌──────────┬──────────┐
│ bit[10:8] │ bit[7:0]  │
│  mode     │  id       │
│  (3-bit)  │  (8-bit)  │
└──────────┴──────────┘
```

**发送帧 (主机→电机):**

| 指令类型 | mode | id 字段 | CAN ID 示例 (电机ID=1) |
|---------|------|--------|---------------------|
| 通用指令 (使能/停止/MIT参数/设零/清错/设模式/改ID等) | 0 | 目标电机 canid | 0x001 |
| 位置模式控制 | 1 | 目标电机 canid | 0x101 |
| 速度模式控制 | 2 | 目标电机 canid | 0x201 |

**应答帧 (电机→主机):**

| 应答类型 | mode | id 字段 | CAN ID 示例 (主机ID=0) |
|---------|------|--------|---------------------|
| 应答指令 1 (状态反馈) | 0 | 主机 canid | 0x000 |
| 应答指令 2 (MCU标识) | — | 电机 canid | 0x001 |

---

## 5. MIT 协议指令详解

### 5.1 应答指令 1 (状态反馈)

大多数指令的应答帧格式，包含实时电机状态。

| 字段 | 位置 | 编码 | 物理范围 |
|------|------|------|---------|
| CAN ID | 11-bit | mode=0, id=主机canid | — |
| 电机 canid | Byte0 | uint8 | 0~127 |
| 当前角度 | Byte1~2 | uint16 [0, 65535] | [-12.57, +12.57] rad |
| 当前速度 | Byte3 全8位 + Byte4[7:4] 高4位 | uint12 [0, 4096] | [-33, +33] rad/s |
| 当前力矩 | Byte4[3:0] 低4位 + Byte5 全8位 | uint12 [0, 4096] | [-14, +14] N.m |
| 绕组温度 | Byte6~7 | uint16 | Temp(°C) × 10 |

**位拼接图示:**

```
Byte0    Byte1    Byte2    Byte3    Byte4    Byte5    Byte6    Byte7
[motor ] [angle_H] [angle_L] [vel_H8 ] [vL4|tH4] [torq_L8] [temp_H ] [temp_L ]
│        │←── 16-bit ──→│  │← 12b →│← 12b →│         │←── 16-bit ──→│
│        │   angle        │  │ velocity│ torque  │         │  temperature  │
```

### 5.2 应答指令 2 (MCU 标识)

仅修改 CAN ID (指令 7) 和修改协议 (指令 8) 使用此应答。

| 字段 | 值 |
|------|-----|
| CAN ID | 电机 canid |
| Byte0~7 | 64-bit MCU 唯一标识符 |

### 5.3 指令 1: 电机使能

| 字段 | 值 |
|------|-----|
| CAN ID | motor_canid (mode=0) |
| Data | `FF FF FF FF FF FF FF FC` |
| 应答 | 应答指令 1 |

### 5.4 指令 2: 电机停止

| 字段 | 值 |
|------|-----|
| CAN ID | motor_canid (mode=0) |
| Data | `FF FF FF FF FF FF FF FD` |
| 应答 | 应答指令 1 |

### 5.5 指令 3: MIT 运控模式动态参数 (核心控制指令)

| 字段 | 值 |
|------|-----|
| CAN ID | motor_canid (mode=0) |
| Data | 5 参数编码 (见下) |
| 应答 | 应答指令 1 |

**8 字节数据编码 (共 64 位):**

| 参数 | 位宽 | 编码范围 | 物理范围 | 字节位置 |
|------|------|---------|---------|---------|
| 目标角度 (p_set) | 16-bit | [0, 65535] | [-12.57, +12.57] rad | Byte0 高8位, Byte1 低8位 |
| 目标速度 (v_set) | 12-bit | [0, 4096] | [-33, +33] rad/s | Byte2 高8位, Byte3[7:4] 低4位 |
| Kp | 12-bit | [0, 4096] | [0, 500] | Byte3[3:0] 高4位, Byte4 低8位 |
| Kd | 12-bit | [0, 4096] | [0, 5] | Byte5 高8位, Byte6[7:4] 低4位 |
| 力矩前馈 (t_ff) | 12-bit | [0, 4096] | [-14, +14] N.m | Byte6[3:0] 高4位, Byte7 低8位 |

**位拼接图示:**

```
Byte0    Byte1    Byte2    Byte3       Byte4    Byte5    Byte6       Byte7
[pos_H8] [pos_L8] [vel_H8] [vL4|kpH4] [kp_L8 ] [kd_H8 ] [kdL4|tH4] [torq_L8]
│←── 16-bit ──→│  │← 12b →│← 12b  →│         │← 12b →│← 12b  →│
│   position     │  │velocity│   Kp     │         │   Kd   │  torque   │
```

**电机内部控制公式:**

```
t_ref = Kd * (v_set - v_actual) + Kp * (p_set - p_actual) + t_ff
```

t_ref 通过内部公式转为 iq 电流参考，进入电流环输出。

### 5.6 指令 4: 设置零点 (非位置模式下可用)

| 字段 | 值 |
|------|-----|
| CAN ID | motor_canid (mode=0) |
| Data | `FF FF FF FF FF FF FF FE` |
| 应答 | 应答指令 1 |

**注意**: CSP 和运控模式下可以标零，PP 模式下无法标零。标零后电机期望值会更新为 0。

### 5.7 指令 5: 清除错误及读取异常状态

| 字段 | 值 |
|------|-----|
| CAN ID | motor_canid (mode=0) |
| Data | `FF FF FF FF FF FF [F_CMD] FB` |
| 应答 | F_CMD=0xFF 时: 应答指令 1; 其他值: 异常状态应答帧 |

- **F_CMD = 0xFF**: 清除当前异常
- **F_CMD = 其他值**: 返回异常状态

**异常状态应答帧:**

| 字段 | 值 |
|------|-----|
| CAN ID | 主机 canid (mode=0) |
| Byte0 | 电机 canid |
| Byte1~4 | fault 值 (32-bit, 非 0 表示有故障) |

**故障位定义:**

| Bit | 故障 |
|-----|------|
| 16 | A 相电流采样过流 |
| 14 | 堵转过载算法保护 |
| 9 | 位置初始化故障 |
| 8 | 硬件识别故障 |
| 7 | 编码器未标定 |
| 5 | C 相电流采样过流 |
| 4 | B 相电流采样过流 |
| 3 | 过压故障 (>60V) |
| 2 | 欠压故障 (<12V) |
| 1 | 驱动芯片故障 |
| 0 | 过温故障 (热敏电阻温度 >145°C) |

### 5.8 指令 6: 设置运行模式

| 字段 | 值 |
|------|-----|
| CAN ID | motor_canid (mode=0) |
| Data | `FF FF FF FF FF FF [F_CMD] FC` |
| 应答 | 应答指令 1 |

| F_CMD 值 | 运行模式 |
|---------|---------|
| 0 | MIT 运控模式 (默认) |
| 1 | 位置模式 (CSP) |
| 2 | 速度模式 |

**注意**: Byte7 = FC 与使能指令 (指令 1) 相同。区分靠 **Byte6**: 使能为 0xFF，设模式为模式值 (0/1/2)。

### 5.9 指令 7: 修改电机 CAN ID

| 字段 | 值 |
|------|-----|
| CAN ID | motor_canid (mode=0) |
| Data | `FF FF FF FF FF FF [new_id] FA` |
| 应答 | 应答指令 2 |

### 5.10 指令 8: 修改电机协议 (需重新上电)

| 字段 | 值 |
|------|-----|
| CAN ID | motor_canid (mode=0) |
| Data | `FF FF FF FF FF FF [F_CMD] FD` |
| 应答 | 应答指令 2 |

| F_CMD 值 | 协议 |
|---------|------|
| 0 | 私有协议 (默认) |
| 1 | CANopen |
| 2 | MIT 协议 |

**注意**: Byte7 = FD 与停止指令 (指令 2) 相同。区分靠 **Byte6**: 停止为 0xFF，切换协议为协议值 (0/1/2)。

### 5.11 指令 9: 修改主机 CAN ID

| 字段 | 值 |
|------|-----|
| CAN ID | motor_canid (mode=0) |
| Data | `FF FF FF FF FF FF FD [new_master_id]` |
| 应答 | 应答指令 2 |

**注意**: Byte6 = 0xFD 为固定标记，Byte7 = 新的主机 CAN ID。

### 5.12 指令 10: 位置模式控制

| 字段 | 值 |
|------|-----|
| CAN ID | (1 << 8) \| motor_canid (mode=1) |
| Byte0~3 | 目标位置 (rad, 32-bit float, IEEE 754) |
| Byte4~7 | 过程最大速度 (rad/s, 32-bit float, IEEE 754) |
| 应答 | 应答指令 1 |

### 5.13 指令 11: 速度模式控制

| 字段 | 值 |
|------|-----|
| CAN ID | (2 << 8) \| motor_canid (mode=2) |
| Byte0~3 | 目标速度 (rad/s, 32-bit float, IEEE 754) |
| Byte4~7 | 电流限制 (A, 32-bit float, IEEE 754) |
| 应答 | 应答指令 1 |

**注意**: 原文档 Byte0~3 单位标注为 "rad"、Byte4~7 标注为 "rad/s"，但示例数据为 "速度 5rad/s, 电流 2A"。实际单位以示例为准: **速度 rad/s, 电流 A**。

---

## 6. 三种 MIT 控制模式使用流程

### 6.1 运控模式 (MIT Mode, 默认)

```
指令6(设模式=0) → 指令1(使能) → 循环发送 指令3(5参数) → 指令2(停止)
```

**控制公式**: `t_ref = Kd * (v_set - v_actual) + Kp * (p_set - p_actual) + t_ff`

**典型控制演示:**

| 场景 | t_ff | v_set | Kd | p_set | Kp | 效果 |
|------|------|-------|-----|-------|-----|------|
| 纯速度控制 | 0 | 1 | 1 | 0 | 0 | 1 rad/s 运行; 加大 Kd 抵御外部负载 |
| 阻尼模式 | 0 | 0 | 1 | 0 | 0 | 外部转动电机时产生阻尼; Kd 越大阻尼越大 |
| 位置保持 | 0 | 0 | 1 | 5 | 1 | 运行到 5rad; Kp 增大→位置力增大, 需要 Kd 抑制振荡 |

**注意**: 阻尼模式下电机会发电，需要电源馈电防止过压。

### 6.2 速度模式

```
指令6(设模式=2) → 指令1(使能) → 循环发送 指令11(速度+电流限制) → 指令2(停止)
```

电机内部控制链: 设定速度 → 速度 PI → 电流限幅 → 电流 PI → SVPWM → 电机

### 6.3 位置模式 (CSP)

```
指令6(设模式=1) → 指令1(使能) → 循环发送 指令10(位置+速度) → 指令2(停止)
```

电机内部控制链: 设定位置 → 位置 Kp → 速度限幅 → 速度 PI → 电流限幅 → 电流 PI → SVPWM → 电机

---

## 7. 编码/解码参考

### 7.1 参数范围常量

```cpp
// MIT 模式参数范围 (固件 v0.0.2.6+)
#define P_MIN  -12.57f    // position min (rad) — v0.0.2.6 之前为 ±12.5
#define P_MAX   12.57f    // position max (rad)
#define V_MIN  -33.0f     // velocity min (rad/s)
#define V_MAX   33.0f     // velocity max (rad/s)
#define KP_MIN  0.0f
#define KP_MAX  500.0f
#define KD_MIN  0.0f
#define KD_MAX  5.0f
#define T_MIN  -14.0f     // torque min (N.m)
#define T_MAX   14.0f     // torque max (N.m)
```

### 7.2 编码函数 (float → uint)

```cpp
int float_to_uint(float x, float x_min, float x_max, int bits) {
    float span = x_max - x_min;
    if (x > x_max) x = x_max;
    else if (x < x_min) x = x_min;
    return (int)((x - x_min) * ((float)((1 << bits) - 1)) / span);
}
```

### 7.3 解码函数 (uint → float)

```cpp
float uint_to_float(int x_int, float x_min, float x_max, int bits) {
    float span = x_max - x_min;
    return ((float)x_int) * span / ((float)((1 << bits) - 1)) + x_min;
}
```

### 7.4 MIT 指令 3 编码示例 (C++)

```cpp
// 编码 5 参数到 8 字节
void encode_mit_params(uint8_t data[8],
                       float position, float velocity,
                       float kp, float kd, float torque)
{
    uint16_t pos_u  = float_to_uint(position, P_MIN, P_MAX, 16);
    uint16_t vel_u  = float_to_uint(velocity, V_MIN, V_MAX, 12);
    uint16_t kp_u   = float_to_uint(kp, KP_MIN, KP_MAX, 12);
    uint16_t kd_u   = float_to_uint(kd, KD_MIN, KD_MAX, 12);
    uint16_t torq_u = float_to_uint(torque, T_MIN, T_MAX, 12);

    data[0] = pos_u >> 8;                           // position 高 8 位
    data[1] = pos_u & 0xFF;                         // position 低 8 位
    data[2] = vel_u >> 4;                            // velocity 高 8 位
    data[3] = ((vel_u & 0xF) << 4) | (kp_u >> 8);   // velocity 低 4 位 | kp 高 4 位
    data[4] = kp_u & 0xFF;                          // kp 低 8 位
    data[5] = kd_u >> 4;                             // kd 高 8 位
    data[6] = ((kd_u & 0xF) << 4) | (torq_u >> 8);  // kd 低 4 位 | torque 高 4 位
    data[7] = torq_u & 0xFF;                        // torque 低 8 位
}
```

### 7.5 应答指令 1 解码示例 (C++)

```cpp
// 从 8 字节解码反馈
void decode_feedback(const uint8_t data[8],
                     uint8_t &motor_id, float &angle,
                     float &velocity, float &torque, float &temp_c)
{
    motor_id = data[0];

    uint16_t angle_u = (data[1] << 8) | data[2];
    uint16_t vel_u   = (data[3] << 4) | (data[4] >> 4);
    uint16_t torq_u  = ((data[4] & 0xF) << 8) | data[5];
    uint16_t temp_u  = (data[6] << 8) | data[7];

    angle    = uint_to_float(angle_u, P_MIN, P_MAX, 16);
    velocity = uint_to_float(vel_u, V_MIN, V_MAX, 12);
    torque   = uint_to_float(torq_u, T_MIN, T_MAX, 12);
    temp_c   = (float)temp_u / 10.0f;
}
```

---

## 8. 指令辨别速查表

通用指令 (mode=0) 均通过 **Byte6 和 Byte7 的组合** 区分:

| 指令 | Byte0~5 | Byte6 | Byte7 | 说明 |
|------|---------|-------|-------|------|
| 指令 1: 使能 | FF FF FF FF FF FF | **FF** | **FC** | |
| 指令 6: 设模式 | FF FF FF FF FF FF | **F_CMD** (0/1/2) | **FC** | Byte6≠0xFF 与使能区分 |
| 指令 2: 停止 | FF FF FF FF FF FF | **FF** | **FD** | |
| 指令 8: 改协议 | FF FF FF FF FF FF | **F_CMD** (0/1/2) | **FD** | Byte6≠0xFF 与停止区分 |
| 指令 4: 设零点 | FF FF FF FF FF FF | **FF** | **FE** | |
| 指令 5: 清错/读错 | FF FF FF FF FF FF | **F_CMD** | **FB** | F_CMD=0xFF 清除, 其他读取 |
| 指令 7: 改电机ID | FF FF FF FF FF FF | **new_id** | **FA** | |
| 指令 9: 改主机ID | FF FF FF FF FF FF | **FD** | **new_master_id** | Byte6=0xFD 为固定标记 |
| 指令 3: MIT参数 | (编码数据) | (编码数据) | (编码数据) | 非 FF 填充，与上述均不同 |

---

## 9. 非 MIT 但可能需要的功能

以下功能需通过**私有协议** (扩展帧) 的通信类型 18 (参数写入) 实现。
如果电机已切换到 MIT 协议，需要先切回私有协议或通过上位机修改。

### 9.1 CAN 通信超时保护

| 参数 | Index | 类型 | 默认值 | 说明 |
|------|-------|------|--------|------|
| canTimeout | 0x7028 | uint32 | 0 (禁用) | 20000 = 1 秒; 超时后电机进入 reset 模式 |

### 9.2 主动上报 (Active Reporting)

- 默认关闭
- 通过私有协议通信类型 24 开启
- 上报类型为类型 2 反馈帧
- 默认间隔 10ms，可通过 EPScan_time 参数修改 (1=10ms, 每+1 增加 5ms)

### 9.3 电机内部 PID 参数 (可通过私有协议类型 18 读写)

| Index | 名称 | 描述 | 类型 | 默认值 | R/W |
|-------|------|------|------|--------|-----|
| 0x7010 | cur_kp | 电流环 Kp | float | 0.025 | W/R |
| 0x7011 | cur_ki | 电流环 Ki | float | 0.0258 | W/R |
| 0x7014 | cur_filt_gain | 电流滤波系数 | float | 0.1 | W/R |
| 0x701E | loc_kp | 位置环 Kp | float | 40 (默认30) | W/R |
| 0x701F | spd_kp | 速度环 Kp | float | 6 (默认2) | W/R |
| 0x7020 | spd_ki | 速度环 Ki | float | 0.02 (默认0.021) | W/R |
| 0x7021 | spd_filt_gain | 速度滤波系数 | float | 0.1 | W/R |

### 9.4 限制参数

| Index | 名称 | 描述 | 类型 | 默认值 | R/W |
|-------|------|------|------|--------|-----|
| 0x700B | limit_torque | 力矩限制 | float | 14 N.m | W/R |
| 0x7017 | limit_spd | CSP 速度限制 | float | 2 rad/s (范围 0~33) | W/R |
| 0x7018 | limit_cur | 位置/速度模式电流限制 | float | 23 A (范围 0~16A) | W/R |
| 0x7022 | acc_rad | 速度模式加速度 | float | 20 rad/s² | W/R |
| 0x7024 | vel_max | PP 模式速度 | float | 10 rad/s | W/R |
| 0x7025 | acc_set | PP 模式加速度 | float | 10 rad/s² | W/R |

### 9.5 只读状态参数

| Index | 名称 | 描述 | 类型 |
|-------|------|------|------|
| 0x7019 | mechPos | 负载端计圈机械角度 | float (rad) |
| 0x701A | iqf | iq 滤波值 | float (-16~16A) |
| 0x701B | mechVel | 负载端转速 | float (-33~33 rad/s) |
| 0x701C | VBUS | 母线电压 | float (V) |

### 9.6 零点相关

| 参数 | Index | 默认值 | 说明 |
|------|-------|--------|------|
| zero_sta | 0x7029 | 0 | 0: 零位范围 0~2π; 1: 零位范围 -π~π |
| add_offset | 0x702B | 0 | 零位偏置 (rad); 设为 1 则当前零点加 1rad |

### 9.7 阻尼开关 (Damper)

| 参数 | Index | 默认值 | 说明 |
|------|-------|--------|------|
| damper | 0x702A | 0 | 0: 开启反驱保护 (断电有阻尼); 1: 关闭反驱保护 |

### 9.8 主动上报配置

| 参数 | Index | 类型 | 默认值 | 说明 |
|------|-------|------|--------|------|
| EPScan_time | 0x7026 | uint16 | 1 | 上报间隔; 1=10ms, 每+1 增加 5ms |

---

## 10. 与 DJI 电机的关键差异 (NCAS 集成参考)

| 项目 | DJI (6020/3508/2006) | RS00 MIT |
|------|---------------------|----------|
| CAN 帧类型 | 标准帧 11-bit | 标准帧 11-bit |
| 控制帧格式 | **一拖四** (1 帧控 4 电机) | **一对一** (1 帧控 1 电机) |
| 控制方式 | 主机做 PID，发送电压/电流原始值 | **电机内置 PID**，发送 5 参数/速度/位置 |
| 外部 PID 需求 | 需要 (位置环、速度环) | **不需要** (速度/位置模式下电机内部闭环) |
| 反馈方式 | 电机自主周期上报 | **命令应答** (收到指令后回复); 可开启主动上报 |
| 反馈 CAN ID | 固定范围 0x201~0x20B | 主机 canid (默认 0x000) |
| 编码器 | 8192 counts (6020) / 反馈中直接给 rpm | 14-bit (16384 counts); 反馈给 rad 和 rad/s |
| 减速比 | 无(6020) / 19:1(3508) / 36:1(2006) | 10:1 |
| 控制频率 | 取决于主机 (NCAS 500Hz) | 取决于主机发送频率; 电机内部环路独立运行 |

### NCAS 集成关键点

1. **不能使用一拖四 stage+flush 模式** — 每个 RS00 需独立 CAN 帧
2. **速度/位置模式不需要外部 PID** — 电机内部完成闭环
3. **MIT 运控模式** 提供 Kp/Kd 柔顺控制，适合需要力控的场景
4. **反馈为指令应答** — 每次发送控制指令后会收到反馈帧; 如需周期反馈需开启主动上报
5. **CAN ID 编码含模式位** — bit[10:8] 编码模式类型，需注意 Waveshare 13 字节透传协议中标准帧的 frame_info 设置
6. **反馈帧 CAN ID = 主机 ID** — 默认为 0x000，所有 RS00 电机的反馈帧 CAN ID 相同，通过 Byte0 (电机 canid) 区分来源

---

## 11. 文档版本

| 版本 | 说明 | 日期 |
|------|------|------|
| 1.0 | 初版，基于 RS00使用说明书260112.pdf 整理 | 2026-02-27 |
