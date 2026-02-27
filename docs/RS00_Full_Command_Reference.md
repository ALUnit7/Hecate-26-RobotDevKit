# RS00 完整指令参考 (上位机开发用)

灵足时代 RS00 CAN 伺服电机全部通信指令整理，涵盖 MIT 协议和私有协议。
基于 RS00使用说明书260112.pdf + H26RDK 实际调试验证。

---

## 1. 协议总览

RS00 支持三种 CAN 通信协议，通过 MIT 指令 8 或私有协议 type 25 切换 (需重新上电):

| 协议 | CAN 帧类型 | ID 位宽 | 出厂默认 |
|------|-----------|---------|---------|
| 私有协议 | 扩展帧 | 29-bit | ✅ |
| MIT 协议 | 标准帧 | 11-bit | ❌ |
| CANopen | 标准帧 | 11-bit | ❌ |

### 默认配置

| 参数 | 默认值 |
|------|--------|
| motor_id (电机 CAN ID) | 127 (0x7F) |
| master_id (主机 CAN ID) | 253 (0xFD) |
| CAN 波特率 | 1 Mbps |
| 通信协议 | 私有协议 |

---

## 2. MIT 协议 (标准帧 11-bit)

### 2.1 CAN ID 编码

```
bit[10:8] = mode (3-bit)    bit[7:0] = id (8-bit)
can_id = (mode << 8) | id
```

**发送 (主机→电机):**

| 指令类型 | mode | id | 示例 (motor=127) |
|---------|------|----|----|
| 通用指令 | 0 | motor_id | `0x07F` |
| 位置模式 | 1 | motor_id | `0x17F` |
| 速度模式 | 2 | motor_id | `0x27F` |

**应答 (电机→主机):**

| 类型 | mode | id | 示例 (master=253) |
|------|------|----|----|
| 应答指令 1 (状态反馈) | 0 | master_id | `0x0FD` |
| 应答指令 2 (MCU 标识) | — | motor_id | `0x07F` |

### 2.2 应答指令 1: 状态反馈

大多数指令的应答格式:

```
Byte0    Byte1    Byte2    Byte3    Byte4    Byte5    Byte6    Byte7
[motor ] [angle_H] [angle_L] [vel_H8 ] [vL4|tH4] [torq_L8] [temp_H ] [temp_L ]
```

| 字段 | 位宽 | 范围 |
|------|------|------|
| motor_id | 8-bit | 0~127 |
| angle | 16-bit | [-12.57, +12.57] rad |
| velocity | 12-bit | [-33, +33] rad/s |
| torque | 12-bit | [-14, +14] N.m |
| temperature | 16-bit | 实际温度 × 10 (°C) |

### 2.3 应答指令 2: MCU 标识

仅指令 7 (改电机 ID) 和指令 8 (改协议) 返回:

CAN ID = motor_id, Byte0~7 = 64-bit MCU 唯一标识符

### 2.4 MIT 指令汇总

所有通用指令 CAN ID = `(0 << 8) | motor_id`，通过 Byte6 + Byte7 组合区分:

| 指令 | Byte0~5 | Byte6 | Byte7 | 应答 | 说明 |
|------|---------|-------|-------|------|------|
| 1: 使能 | `FF FF FF FF FF FF` | `FF` | `FC` | 应答1 | |
| 2: 停止 | `FF FF FF FF FF FF` | `FF` | `FD` | 应答1 | |
| 3: MIT 5参数 | (编码数据) | (编码) | (编码) | 应答1 | 详见 §2.5 |
| 4: 设零点 | `FF FF FF FF FF FF` | `FF` | `FE` | 应答1 | CSP/运控可用，PP 不可 |
| 5: 清错/读错 | `FF FF FF FF FF FF` | F_CMD | `FB` | 应答1/故障帧 | FF=清除, 其他=读取 |
| 6: 设模式 | `FF FF FF FF FF FF` | mode(0/1/2) | `FC` | 应答1 | Byte6≠FF 与使能区分 |
| 7: 改电机 ID | `FF FF FF FF FF FF` | new_id | `FA` | 应答2 | |
| 8: 改协议 | `FF FF FF FF FF FF` | proto(0/1/2) | `FD` | 应答2 | 需重新上电; Byte6≠FF 与停止区分 |
| 9: 改主机 ID | `FF FF FF FF FF FF` | `FD` | new_master | 应答2 | Byte6=FD 为固定标记 |
| 10: 位置控制 | pos(f32 LE) | speed(f32 LE) | | 应答1 | CAN ID mode=1 |
| 11: 速度控制 | speed(f32 LE) | cur_lim(f32 LE) | | 应答1 | CAN ID mode=2 |

### 2.5 MIT 5 参数编码 (指令 3)

```
Byte0    Byte1    Byte2    Byte3       Byte4    Byte5    Byte6       Byte7
[pos_H8] [pos_L8] [vel_H8] [vL4|kpH4] [kp_L8 ] [kd_H8 ] [kdL4|tH4] [torq_L8]
```

| 参数 | 位宽 | 范围 |
|------|------|------|
| position | 16-bit | [-12.57, +12.57] rad |
| velocity | 12-bit | [-33, +33] rad/s |
| Kp | 12-bit | [0, 500] |
| Kd | 12-bit | [0, 5] |
| torque | 12-bit | [-14, +14] N.m |

电机内部公式: `t_ref = Kd*(v_set - v_actual) + Kp*(p_set - p_actual) + t_ff`

### 2.6 控制流程

```
MIT 运控:  指令6(mode=0) → 指令1(使能) → 循环 指令3(5参数) → 指令2(停止)
位置模式:  指令6(mode=1) → 指令1(使能) → 循环 指令10(位置+速度) → 指令2(停止)
速度模式:  指令6(mode=2) → 指令1(使能) → 循环 指令11(速度+电流限制) → 指令2(停止)
```

---

## 3. 私有协议 (扩展帧 29-bit)

### 3.1 29-bit CAN ID 编码

```
bit[28:24] = comm_type  (5-bit, 通信类型 0~31)
bit[23:8]  = data_area2 (16-bit, 含义因类型而异)
bit[7:0]   = target_id  (8-bit, 目标电机 CAN ID)
```

```c
uint32_t ext_id = ((comm_type & 0x1F) << 24) | ((data_area2 & 0xFFFF) << 8) | target_id;
```

### 3.2 发送帧 data_area2 通用格式

大多数发送帧: `data_area2 = (master_id << 8) | 0x00`

### 3.3 私有协议通信类型汇总

#### 发送指令 (主机→电机)

| Type | 名称 | data_area2 | 8 字节数据 | 说明 |
|------|------|-----------|-----------|------|
| 0 | 获取 Device ID | `(master_id << 8)` | 全 0 | 返回 64-bit MCU 唯一标识 |
| 3 | 使能电机 | `(master_id << 8)` | 全 0 | |
| 4 | 停止电机 | `(master_id << 8)` | Byte0: 0=停止, 1=清除故障 | |
| 4* | 读取固件版本 | `(master_id << 8)` | `00 C4 00 00 00 00 00 00` | 响应通过 type 2 返回 |
| 6 | 设置机械零点 | `(master_id << 8)` | Byte0=1 | |
| 7 | 设置电机 CAN ID | `(new_id << 8) \| master_id` | 全 0 | data_area2 特殊编码 |
| 0x11 (17) | 读取参数 | `(master_id << 8)` | Byte0-1=index(LE) | |
| 0x12 (18) | 写入参数 | `(master_id << 8)` | Byte0-1=index(LE), Byte4-7=value(LE) | 掉电丢失 |
| 0x15 (21) | 请求故障状态 | `(master_id << 8)` | 全 0 | |
| 0x16 (22) | 保存参数至 Flash | `(master_id << 8)` | `01 02 03 04 05 06 07 08` | 固定数据 |
| 0x17 (23) | 修改 CAN 波特率 | `(master_id << 8)` | `01 02 03 04 05 06 [code] 00` | 需重新上电 |
| 0x18 (24) | 开关主动上报 | `(master_id << 8)` | `01 02 03 04 05 06 [0/1] 00` | 0=关, 1=开 |
| 0x19 (25) | 切换通信协议 | `(master_id << 8)` | `01 02 03 04 05 06 [proto] 00` | 需重新上电 |

#### 响应帧 (电机→主机)

| Type | 名称 | data_area2 | 8 字节数据 | 说明 |
|------|------|-----------|-----------|------|
| 0 | Device ID 应答 | `(motor_id)` | 64-bit MCU ID | 也用于 CAN ID 扫描 |
| 2 | 状态反馈 | 见下方编码 | 角度/速度/力矩/温度 | 控制命令应答 + 主动上报 |
| 2* | 版本应答 | 同上 | `00 C4 56 [v3] [v2] [v1] [v0] 00` | Byte0-2=`00 C4 56` 为签名 |
| 0x11 (17) | 参数读取应答 | `(status << 8) \| motor_id` | Byte0-1=index(LE), Byte4-7=value(LE) | status: 00=成功, 01=失败 |
| 0x15 (21) | 故障应答 | — | Byte0-3=fault_word(LE, 32-bit) | |
| 0x18 (24) | 主动上报帧 | 同 type 2 | 同 type 2 格式 | |

#### Type 2 data_area2 编码

```
bit[7:0]   = motor_id
bit[13:8]  = fault_bits (6-bit)
bit[15:14] = mode_status (0=Reset, 1=Cali, 2=Motor)
```

#### Type 2 数据字节

```
Byte0-1: angle    uint16  → [-12.57, +12.57] rad (uint_to_float, 16-bit)
Byte2-3: velocity uint16  → [-33, +33] rad/s (uint_to_float, 16-bit)
Byte4-5: torque   uint16  → [-14, +14] N.m (uint_to_float, 16-bit)
Byte6-7: temperature × 10
```

> 注意: 私有协议 type 2 的 velocity 和 torque 用 **16-bit** 编码，MIT 应答中用 12-bit。

#### 版本应答识别

当 type 2 帧的 Byte0=0x00, Byte1=0xC4, Byte2=0x56 ('V') 时，为固件版本响应:
- Byte3~6: 版本号 (高→低)，如 `0x00 0x00 0x03 0x16` = v0.0.3.22

### 3.4 波特率代码

| code | 波特率 |
|------|--------|
| 1 | 1 Mbps |
| 2 | 500 Kbps |
| 3 | 250 Kbps |
| 4 | 125 Kbps |

### 3.5 协议代码

| code | 协议 |
|------|------|
| 0 | 私有协议 (默认) |
| 1 | CANopen |
| 2 | MIT |

---

## 4. 参数表 (通过 type 17/18 读写)

### 4.1 可读写参数 (0x7xxx 索引空间)

通过 type 17 读取、type 18 写入。写入为 RAM 操作 (掉电丢失)，需 type 22 保存至 Flash。

| Index | 名称 | 类型 | 默认值 | 说明 |
|-------|------|------|--------|------|
| 0x7005 | run_mode | u8 | 0 | 运行模式: 0=MIT, 1=PP, 2=Speed, 3=Current, 5=CSP |
| 0x7006 | iq_ref | f32 | 0 | 电流模式 Iq 指令 (A) |
| 0x700A | spd_ref | f32 | 0 | 速度指令 (rad/s) |
| 0x700B | limit_torque | f32 | 14 | 力矩限制 (N.m) |
| 0x7010 | cur_kp | f32 | 0.125 | 电流环 Kp |
| 0x7011 | cur_ki | f32 | 0.0158 | 电流环 Ki |
| 0x7014 | cur_filt_gain | f32 | 0.1 | 电流滤波系数 (0~1) |
| 0x7016 | loc_ref | f32 | 0 | 位置指令 (rad) |
| 0x7017 | limit_spd | f32 | 33 | CSP 速度限制 (rad/s) |
| 0x7018 | limit_cur | f32 | 16 | 电流限制 (A) |
| 0x701E | loc_kp | f32 | 30 | 位置环 Kp |
| 0x701F | spd_kp | f32 | 5 | 速度环 Kp |
| 0x7020 | spd_ki | f32 | 0.02 | 速度环 Ki |
| 0x7021 | spd_filt_gain | f32 | 0.05 | 速度滤波系数 (0~1) |
| 0x7022 | acc_rad | f32 | 100 | 速度模式加速度 (rad/s²) |
| 0x7024 | vel_max | f32 | 10 | PP 模式速度 (rad/s) |
| 0x7025 | acc_set | f32 | 10 | PP 模式加速度 (rad/s²) |
| 0x7026 | EPScan_time | u16 | 1 | 上报间隔 (1=10ms, 每+1 加 5ms) |
| 0x7028 | canTimeout | u32 | 0 | CAN 超时 (20000=1s, 0=禁用) |
| 0x7029 | zero_sta | u8 | 0 | 零位模式 (0=0~2π, 1=-π~π) |
| 0x702A | damper | u8 | 0 | 阻尼开关 (0=开, 1=关) |
| 0x702B | add_offset | f32 | 0 | 零位偏置 (rad) |

> 以上默认值来自实测 (固件 v0.0.3.22)，可能与 PDF 文档中的 0x2xxx 参数表默认值不同。

### 4.2 只读参数 (0x3xxx 索引空间)

> **注意: 固件 < 0.0.3.5 会拒绝 0x3xxx 读取 (type 17 应答 status=0x01)**。
> 完整参数读取需固件 ≥ 0.0.3.5。实时数据也可通过 type 2 反馈帧获取。

| Index | 名称 | 类型 | 说明 |
|-------|------|------|------|
| 0x3005 | mcuTemp | i16 | MCU 温度 (×10) |
| 0x3006 | motorTemp | i16 | 电机 NTC 温度 (×10) |
| 0x3007 | vBus_mv | u16 | 母线电压 (mV) |
| 0x300C | VBUS | f32 | 母线电压 (V) |
| 0x300E | cmdIq | f32 | Iq 指令 (A) |
| 0x3015 | modPos | f32 | 单圈角度 (rad) |
| 0x3016 | mechPos | f32 | 多圈位置 (rad) |
| 0x3017 | mechVel | f32 | 负载端速度 (rad/s) |
| 0x301E | iqf | f32 | 滤波后 Iq (A) |
| 0x3022 | faultSta | u32 | 故障状态字 |
| 0x302C | torque_fdb | f32 | 力矩反馈 (N.m) |

### 4.3 参数读写帧格式

**读取 (type 17):**

```
TX ext_id: comm_type=0x11, data_area2=(master_id<<8), target=motor_id
TX data:   [index_lo] [index_hi] [00] [00] [00] [00] [00] [00]

RX ext_id: comm_type=0x11, data_area2=(status<<8)|motor_id, target=master_id
RX data:   [index_lo] [index_hi] [00] [00] [val_b0] [val_b1] [val_b2] [val_b3]
           status: 0x00=成功, 0x01=失败
```

**写入 (type 18):**

```
TX ext_id: comm_type=0x12, data_area2=(master_id<<8), target=motor_id
TX data:   [index_lo] [index_hi] [00] [00] [val_b0] [val_b1] [val_b2] [val_b3]
           value 为 little-endian (u8/u16/u32/f32)
```

> 写入仅修改 RAM，掉电丢失。必须发送 type 22 (保存至 Flash) 才能持久化。

---

## 5. 故障状态位定义

通过 MIT 指令 5 (读错) 或私有协议 type 21 获取:

| Bit | 故障 |
|-----|------|
| 0 | 过温 (>145°C) |
| 1 | 驱动芯片故障 |
| 2 | 欠压 (<12V) |
| 3 | 过压 (>60V) |
| 4 | B 相过流 |
| 5 | C 相过流 |
| 7 | 编码器未标定 |
| 8 | 硬件识别故障 |
| 9 | 位置初始化故障 |
| 14 | 堵转过载保护 |
| 16 | A 相过流 |

---

## 6. Waveshare CAN-TO-ETH 网关封装

UDP 端口 20001，每帧 13 字节:

```
Byte0:      frame_info
            bit[7]   = 0 标准帧, 1 扩展帧
            bit[6]   = 0 数据帧, 1 远程帧
            bit[3:0] = DLC (固定 8)
Byte1~4:   CAN ID (4 字节 big-endian)
Byte5~12:  8 字节 CAN 数据
```

| 协议 | frame_info | CAN ID 用法 |
|------|-----------|------------|
| MIT (标准帧) | `0x08` | Byte3-4 = 11-bit CAN ID |
| 私有协议 (扩展帧) | `0x88` | Byte1-4 = 29-bit CAN ID |

---

## 7. 常用操作流程

### 7.1 CAN ID 扫描 (发现未知电机)

```
对 motor_id = 0~127:
    发送 type 0 (获取 Device ID) 到每个 ID
    等待 5ms
收集所有 type 0 应答帧，data_area2 低字节 = 电机实际 CAN ID
```

### 7.2 修改电机 CAN ID (私有协议)

```
1. 发送 type 7: data_area2 = (new_id << 8) | master_id, target = current_motor_id
2. 发送 type 22: 保存参数至 Flash
3. 电机断电重启
4. 用新 ID 重新连接
```

### 7.3 MIT ↔ 私有协议切换

**从私有协议切到 MIT:**
```
发送 type 25: protocol = 2 (MIT)
电机断电重启
```

**从 MIT 切回私有协议:**
```
发送 MIT 指令 8: Byte6 = 0 (私有协议)
电机断电重启
```

### 7.4 开启主动上报 (私有协议)

```
发送 type 24: enable = 1
电机开始以 EPScan_time 间隔发送 type 2 反馈帧
```

### 7.5 读取固件版本

```
发送 type 4 (停止命令) + 特殊数据: Byte0=0x00, Byte1=0xC4
等待 type 2 应答，检查签名: Byte0=0x00, Byte1=0xC4, Byte2=0x56
Byte3~6 = 版本号 (高→低)
```

> 这不会导致电机停止。电机对 type 4 的数据内容做进一步解析。

### 7.6 保存参数

```
发送 type 22: data = [01 02 03 04 05 06 07 08] (固定值)
```

---

## 8. 编解码函数参考

```c
#define P_MIN  -12.57f
#define P_MAX   12.57f
#define V_MIN  -33.0f
#define V_MAX   33.0f
#define KP_MIN  0.0f
#define KP_MAX  500.0f
#define KD_MIN  0.0f
#define KD_MAX  5.0f
#define T_MIN  -14.0f
#define T_MAX   14.0f

int float_to_uint(float x, float x_min, float x_max, int bits) {
    float span = x_max - x_min;
    if (x > x_max) x = x_max;
    else if (x < x_min) x = x_min;
    return (int)((x - x_min) * ((float)((1 << bits) - 1)) / span);
}

float uint_to_float(int x_int, float x_min, float x_max, int bits) {
    float span = x_max - x_min;
    return ((float)x_int) * span / ((float)((1 << bits) - 1)) + x_min;
}
```

---

## 9. 已知问题与注意事项

1. **0x3xxx 参数读取**: 固件 < 0.0.3.5 会拒绝，应答 data_area2 高字节 = 0x01
2. **MIT 无主动反馈**: 只在收到指令后应答，如需持续监控需通过私有协议开启 type 24
3. **指令 1 vs 指令 6**: 使能和设模式都以 `FC` 结尾，靠 Byte6 区分 (FF=使能, 0/1/2=模式)
4. **指令 2 vs 指令 8**: 停止和改协议都以 `FD` 结尾，靠 Byte6 区分 (FF=停止, 0/1/2=协议)
5. **type 18 写入**: 仅修改 RAM，必须 type 22 才能持久化
6. **Windows UDP 10054**: Waveshare 网关在某些情况下会触发 ICMP port unreachable，属正常现象，忽略即可
7. **版本响应**: 通过 type 4 特殊数据 (`00 C4`) 触发，但应答以 type 2 帧返回 (签名 `00 C4 56`)
8. **多电机**: MIT 反馈帧 CAN ID = master_id (所有电机相同)，通过 Byte0 区分; 私有协议 type 2 通过 data_area2 低字节区分
