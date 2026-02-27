# RS00 MIT 控制协议参考 (机器人协议层开发用)

面向机器人控制系统集成，仅包含 MIT 协议下的控制指令、反馈解析和控制流程。

---

## 1. CAN 帧基础

- 标准帧 (11-bit ID)，波特率 1Mbps，数据长度固定 8 字节
- 经 Waveshare CAN-TO-ETH 网关透传时，每帧封装为 13 字节 UDP 包

### 11-bit CAN ID 编码

```
bit[10:8] = mode (3-bit)    bit[7:0] = id (8-bit)
```

| 方向 | mode | id 字段 | 示例 (motor=1, master=0) |
|------|------|---------|-------------------------|
| 主机→电机: 通用指令 | 0 | motor_id | `0x001` |
| 主机→电机: 位置模式 | 1 | motor_id | `0x101` |
| 主机→电机: 速度模式 | 2 | motor_id | `0x201` |
| 电机→主机: 状态反馈 | 0 | master_id | `0x000` |

```c
uint16_t can_id = (mode << 8) | motor_id;
```

---

## 2. 反馈帧解析 (所有控制指令共用)

电机收到任何控制指令后均返回此格式的应答帧。

### CAN ID

`(0 << 8) | master_id`，即 mode=0, id=master_id

### 8 字节数据布局

```
Byte0    Byte1    Byte2    Byte3    Byte4    Byte5    Byte6    Byte7
[motor ] [angle_H] [angle_L] [vel_H8 ] [vL4|tH4] [torq_L8] [temp_H ] [temp_L ]
```

| 字段 | 位宽 | 编码范围 | 物理范围 |
|------|------|---------|---------|
| motor_id | 8-bit (Byte0) | 0~127 | — |
| angle | 16-bit (Byte1-2) | [0, 65535] | [-12.57, +12.57] rad |
| velocity | 12-bit (Byte3 全 + Byte4 高 4 位) | [0, 4095] | [-33, +33] rad/s |
| torque | 12-bit (Byte4 低 4 位 + Byte5 全) | [0, 4095] | [-14, +14] N.m |
| temperature | 16-bit (Byte6-7) | — | 实际温度 × 10 (°C) |

### 解码代码

```c
uint8_t  motor_id = data[0];
uint16_t angle_u  = (data[1] << 8) | data[2];
uint16_t vel_u    = (data[3] << 4) | (data[4] >> 4);
uint16_t torq_u   = ((data[4] & 0x0F) << 8) | data[5];
uint16_t temp_u   = (data[6] << 8) | data[7];

float angle    = uint_to_float(angle_u, -12.57, 12.57, 16);
float velocity = uint_to_float(vel_u,   -33.0,  33.0,  12);
float torque   = uint_to_float(torq_u,  -14.0,  14.0,  12);
float temp_c   = (float)temp_u / 10.0f;
```

### 多电机区分

所有电机的反馈帧 CAN ID 相同 (都是 master_id)，通过 **Byte0 (motor_id)** 区分来源。

---

## 3. 编解码函数

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

## 4. 控制指令

### 4.1 使能电机

CAN ID: `(0 << 8) | motor_id`

```
Data: FF FF FF FF FF FF FF FC
```

### 4.2 停止电机

CAN ID: `(0 << 8) | motor_id`

```
Data: FF FF FF FF FF FF FF FD
```

### 4.3 设置运行模式

CAN ID: `(0 << 8) | motor_id`

```
Data: FF FF FF FF FF FF [mode] FC
```

| mode 值 | 模式 |
|---------|------|
| 0 | MIT 运控模式 (默认) |
| 1 | 位置模式 (CSP) |
| 2 | 速度模式 |

> 注意: 与使能指令同为 `FC` 结尾，区分靠 Byte6: 使能为 `0xFF`，设模式为 `0x00/0x01/0x02`。

### 4.4 设置零点

CAN ID: `(0 << 8) | motor_id`

```
Data: FF FF FF FF FF FF FF FE
```

> CSP 和运控模式下可标零，PP 模式下不可。标零后期望值更新为 0。

### 4.5 清除故障

CAN ID: `(0 << 8) | motor_id`

```
Data: FF FF FF FF FF FF FF FB    ← 清除故障 (Byte6=0xFF)
Data: FF FF FF FF FF FF 00 FB    ← 读取故障 (Byte6≠0xFF)
```

读取故障时应答帧格式不同: Byte0=motor_id, Byte1~4=fault_word (32-bit)。

故障位定义:

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

## 5. 三种控制模式

### 5.1 MIT 运控模式 (mode=0)

**流程:**

```
设模式(mode=0) → 使能 → 循环发送 MIT 5参数 → 停止
```

**CAN ID:** `(0 << 8) | motor_id`

**8 字节数据编码 (5 个参数共 64 位):**

```
Byte0    Byte1    Byte2    Byte3       Byte4    Byte5    Byte6       Byte7
[pos_H8] [pos_L8] [vel_H8] [vL4|kpH4] [kp_L8 ] [kd_H8 ] [kdL4|tH4] [torq_L8]
│←── 16-bit ──→│  │← 12b →│← 12b  →│         │← 12b →│← 12b  →│
│   position     │  │velocity│   Kp     │         │   Kd   │  torque   │
```

| 参数 | 位宽 | 物理范围 |
|------|------|---------|
| position (p_set) | 16-bit | [-12.57, +12.57] rad |
| velocity (v_set) | 12-bit | [-33, +33] rad/s |
| Kp | 12-bit | [0, 500] |
| Kd | 12-bit | [0, 5] |
| torque (t_ff) | 12-bit | [-14, +14] N.m |

**编码:**

```c
void encode_mit(uint8_t data[8], float pos, float vel, float kp, float kd, float torque) {
    uint16_t pos_u  = float_to_uint(pos,    P_MIN,  P_MAX,  16);
    uint16_t vel_u  = float_to_uint(vel,    V_MIN,  V_MAX,  12);
    uint16_t kp_u   = float_to_uint(kp,     KP_MIN, KP_MAX, 12);
    uint16_t kd_u   = float_to_uint(kd,     KD_MIN, KD_MAX, 12);
    uint16_t torq_u = float_to_uint(torque, T_MIN,  T_MAX,  12);

    data[0] = pos_u >> 8;
    data[1] = pos_u & 0xFF;
    data[2] = vel_u >> 4;
    data[3] = ((vel_u & 0xF) << 4) | (kp_u >> 8);
    data[4] = kp_u & 0xFF;
    data[5] = kd_u >> 4;
    data[6] = ((kd_u & 0xF) << 4) | (torq_u >> 8);
    data[7] = torq_u & 0xFF;
}
```

**电机内部控制公式:**

```
t_ref = Kd * (v_set - v_actual) + Kp * (p_set - p_actual) + t_ff
```

**典型使用场景:**

| 场景 | pos | vel | Kp | Kd | torque | 效果 |
|------|-----|-----|----|----|--------|------|
| 纯力矩 | 0 | 0 | 0 | 0 | T | 输出恒定力矩 T |
| 纯速度 | 0 | V | 0 | Kd | 0 | 速度跟踪，Kd 越大抗扰越强 |
| 阻尼 | 0 | 0 | 0 | Kd | 0 | 手动转动时有阻力感 |
| 位置保持 | P | 0 | Kp | Kd | 0 | 到达位置 P 并保持 |
| 柔顺控制 | P | 0 | Kp | Kd | 0 | 低 Kp 实现柔顺，Kd 抑制振荡 |

> 阻尼模式下电机会发电，需电源馈电防止过压。

### 5.2 位置模式 (mode=1, CSP)

**流程:**

```
设模式(mode=1) → 使能 → 循环发送 位置指令 → 停止
```

**CAN ID:** `(1 << 8) | motor_id`

```
Byte0~3: 目标位置 (rad)     — float32 IEEE754 little-endian
Byte4~7: 过程最大速度 (rad/s) — float32 IEEE754 little-endian
```

```c
void encode_position(uint8_t data[8], float target_pos, float max_speed) {
    memcpy(&data[0], &target_pos, 4);   // LE on little-endian platform
    memcpy(&data[4], &max_speed, 4);
}
```

电机内部控制链: 设定位置 → 位置 Kp → 速度限幅 → 速度 PI → 电流限幅 → 电流 PI → SVPWM

### 5.3 速度模式 (mode=2)

**流程:**

```
设模式(mode=2) → 使能 → 循环发送 速度指令 → 停止
```

**CAN ID:** `(2 << 8) | motor_id`

```
Byte0~3: 目标速度 (rad/s)   — float32 IEEE754 little-endian
Byte4~7: 电流限制 (A)       — float32 IEEE754 little-endian
```

```c
void encode_speed(uint8_t data[8], float target_speed, float current_limit) {
    memcpy(&data[0], &target_speed, 4);
    memcpy(&data[4], &current_limit, 4);
}
```

电机内部控制链: 设定速度 → 速度 PI → 电流限幅 → 电流 PI → SVPWM

---

## 6. Waveshare CAN-TO-ETH 13 字节封装

UDP 端口 20001，每帧 13 字节:

```
Byte0:      frame_info
            bit[7]   = 0 标准帧, 1 扩展帧
            bit[6]   = 0 数据帧, 1 远程帧
            bit[3:0] = DLC (固定 8)
Byte1~4:   CAN ID (big-endian, 标准帧用低 11 位)
Byte5~12:  8 字节数据
```

**标准帧 (MIT 协议):**

```c
uint8_t frame[13];
frame[0] = 0x08;                        // 标准帧, 数据帧, DLC=8
frame[1] = 0x00;                        // CAN ID 高位 (标准帧这里为 0)
frame[2] = 0x00;
frame[3] = (can_id >> 8) & 0xFF;       // CAN ID bit[10:8]
frame[4] = can_id & 0xFF;              // CAN ID bit[7:0]
memcpy(&frame[5], data, 8);            // 8 字节 CAN 数据
```

**接收解析:**

```c
uint8_t  frame_info = buf[0];
uint32_t can_id = (buf[1] << 24) | (buf[2] << 16) | (buf[3] << 8) | buf[4];
uint8_t  data[8];
memcpy(data, &buf[5], 8);

bool is_standard = (frame_info & 0xC0) == 0x00;
bool is_extended = (frame_info & 0xC0) == 0x80;
```

---

## 7. 控制循环示例 (伪代码)

```c
// 初始化
udp_connect("192.168.0.7", 20001);

// 设置模式 + 使能
send_mit_cmd(motor_id, CMD_SET_MODE, mode=0);   // MIT 运控
sleep(10ms);
send_mit_cmd(motor_id, CMD_ENABLE);
sleep(10ms);

// 控制循环 (典型 200~1000 Hz)
while (running) {
    // 计算控制量
    float pos = compute_position();
    float vel = compute_velocity();
    float kp  = 30.0;
    float kd  = 1.0;
    float torque = compute_feedforward();

    // 发送 MIT 5 参数
    uint8_t data[8];
    encode_mit(data, pos, vel, kp, kd, torque);
    uint16_t can_id = (0 << 8) | motor_id;
    send_can_frame(can_id, data);

    // 接收反馈 (每次发送后电机回复一帧)
    uint8_t rx[8];
    recv_can_frame(&rx_id, rx);
    if ((rx_id & 0xFF) == master_id) {
        decode_feedback(rx, &id, &angle, &velocity, &torque, &temp);
        // 用于闭环
    }

    sleep_until_next_cycle();
}

// 停止
send_mit_cmd(motor_id, CMD_STOP);
```

### 多电机控制

```c
// 每个电机独立发送 (不支持一拖四)
for (int i = 0; i < num_motors; i++) {
    send_can_frame((0 << 8) | motor_ids[i], motor_data[i]);
}
// 接收所有反馈，通过 Byte0 区分电机
while (has_pending_rx()) {
    recv_can_frame(&rx_id, rx);
    uint8_t from_motor = rx[0];
    // ...
}
```

---

## 8. 注意事项

1. **应答式反馈**: MIT 模式下电机不主动上报，只在收到指令后回复。控制频率 = 发送频率
2. **如需持续反馈**: 需通过私有协议 type 24 开启主动上报 (默认 10ms 间隔)，但需切换到私有协议执行
3. **参数单位**: 角度 rad，速度 rad/s，力矩 N.m，温度 °C (反馈值 ÷ 10)
4. **减速比 10:1**: 反馈的 angle/velocity 是**负载端**数据 (已经过减速比)
5. **编码器 14-bit**: 16384 counts/rev，但 MIT 协议中已编码为 rad
6. **过压保护**: 阻尼模式/急停时电机发电，电源需能承受馈电
7. **CAN 超时**: 默认关闭 (canTimeout=0)，如需安全保护可通过私有协议设置 (20000=1s)
