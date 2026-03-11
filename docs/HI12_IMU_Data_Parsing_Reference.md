# HiPNUC HI12 IMU 数据读取与解析参考

面向运动控制协议层开发，仅包含串口数据读取、二进制帧解析、姿态数据提取。不包含上位机 UI、AT 配置命令等。

---

## 1. 硬件连接

| 参数 | 值 |
|------|-----|
| 接口 | USB 串口（CP210x，VID:10C4 PID:EA60） |
| 默认波特率 | 115200 |
| 数据位 | 8 |
| 停止位 | 1 |
| 校验 | None |
| 默认输出频率 | 100~400Hz（取决于型号和配置） |

H12 系列通电即开始输出 HI91 二进制数据帧，无需发送任何启动命令。

---

## 2. 二进制帧格式

```
Byte:  [0]   [1]   [2]   [3]   [4]   [5]   [6 ... 6+N-1]
Field: SYNC1 SYNC2 LEN_L LEN_H CRC_L CRC_H  PAYLOAD (N bytes)
Value: 0x5A  0xA5  ---- little-endian ----   子包数据
```

| 字段 | 偏移 | 大小 | 说明 |
|------|------|------|------|
| SYNC1 | 0 | 1 | 固定 `0x5A` |
| SYNC2 | 1 | 1 | 固定 `0xA5` |
| Length | 2 | 2 | Payload 长度（小端） |
| CRC16 | 4 | 2 | CRC-CCITT 校验（小端） |
| Payload | 6 | N | 一个或多个子包 |

### CRC16 校验

- 算法：CRC-CCITT，多项式 `0x1021`，初始值 `0`
- 校验范围：`bytes[0..4]`（SYNC1 + SYNC2 + LEN_L + LEN_H）+ `bytes[6..6+N]`（Payload）
- **不包含** CRC 字段本身（bytes[4..6]）

```c
uint16_t crc16_update(uint16_t crc, const uint8_t *data, uint32_t len) {
    for (uint32_t i = 0; i < len; i++) {
        crc ^= (uint16_t)data[i] << 8;
        for (int j = 0; j < 8; j++) {
            uint16_t temp = crc << 1;
            if (crc & 0x8000) temp ^= 0x1021;
            crc = temp;
        }
    }
    return crc & 0xFFFF;
}
```

```python
def crc16_update(crc, data):
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            temp = crc << 1
            if crc & 0x8000:
                temp ^= 0x1021
            crc = temp
    return crc & 0xFFFF
```

---

## 3. HI91 子包（Tag = 0x91）— H12 核心数据包

H12 系列输出此包。Payload 固定 76 字节，第一个字节为 tag `0x91`。

### 字段布局

| 偏移 | 大小 | 字段 | 类型 | 单位 | 说明 |
|------|------|------|------|------|------|
| 0 | 1 | tag | u8 | — | 固定 `0x91` |
| 1 | 2 | main_status | u16 LE | — | 保留 |
| 3 | 1 | temperature | i8 | °C | 芯片温度 |
| 4 | 4 | air_pressure | f32 LE | Pa | 气压 |
| 8 | 4 | system_time | u32 LE | ms | 系统时间戳 |
| 12 | 12 | acc[3] | f32×3 LE | **G** | 加速度（原始单位 G） |
| 24 | 12 | gyr[3] | f32×3 LE | °/s | 角速度 |
| 36 | 12 | mag[3] | f32×3 LE | μT | 磁力计 |
| 48 | 4 | roll | f32 LE | ° | 横滚角 |
| 52 | 4 | pitch | f32 LE | ° | 俯仰角 |
| 56 | 4 | yaw | f32 LE | ° | 偏航角 |
| 60 | 16 | quat[4] | f32×4 LE | — | 四元数 (w, x, y, z) |

> **注意**：acc 原始单位是 G，运动控制通常需要 m/s²，转换系数 `× 9.80665`。

### 数据结构（C）

```c
typedef struct __attribute__((__packed__)) {
    uint8_t   tag;            // 0x91
    uint16_t  main_status;    // 保留
    int8_t    temp;           // 温度 °C
    float     air_pressure;   // 气压 Pa
    uint32_t  system_time;    // 时间戳 ms
    float     acc[3];         // 加速度 [G]  →  × 9.80665 = m/s²
    float     gyr[3];         // 角速度 [°/s]
    float     mag[3];         // 磁力计 [μT]
    float     roll;           // 横滚 [°]
    float     pitch;          // 俯仰 [°]
    float     yaw;            // 偏航 [°]
    float     quat[4];        // 四元数 [w, x, y, z]
} hi91_t;                     // sizeof = 76
```

### 数据结构（Rust）

```rust
pub struct Hi91Data {
    pub acc: [f64; 3],        // m/s² (已乘 9.80665)
    pub gyr: [f64; 3],        // °/s
    pub mag: [f64; 3],        // μT
    pub roll: f64,            // °
    pub pitch: f64,           // °
    pub yaw: f64,             // °
    pub quat: [f64; 4],       // (w, x, y, z)
    pub temperature: i8,      // °C
    pub air_pressure: f64,    // Pa
    pub system_time: u32,     // ms
}
```

---

## 4. 解析状态机

逐字节输入的流式解析器，适用于串口实时数据流。

### 状态转换

```
WaitSync1 ──0x5A──→ WaitSync2 ──0xA5──→ ReadHeader ──4B──→ ReadPayload ──NB──→ Validate
    ↑                    │ 非0xA5              ↑ len异常                        │
    └────────────────────┘                     └────────────────────────────────┘
                         CRC失败也重置到 WaitSync1
```

### C 实现参考

```c
#define CHSYNC1 0x5A
#define CHSYNC2 0xA5
#define CH_HDR_SIZE 6

// 返回值: 1=解析成功, 0=需要更多数据, -1=错误
int hipnuc_input(hipnuc_raw_t *raw, uint8_t data) {
    // HiPNUC 官方 SDK 中 hipnuc_dec.c 提供完整实现
    // 状态机: sync1 → sync2 → header(4B) → payload(NB) → CRC校验 → 解析子包
}

// 批量输入
int hipnuc_input_bytes(hipnuc_raw_t *raw, uint8_t *data, int len) {
    int count = 0;
    for (int i = 0; i < len; i++) {
        if (hipnuc_input(raw, data[i]) == 1) count++;
    }
    return count;
}
```

### Python 实现参考

```python
import struct

GRAVITY = 9.80665

class HI91Parser:
    def __init__(self):
        self.buffer = bytearray()

    def feed(self, data: bytes) -> list[dict]:
        """输入串口原始字节，返回解析出的数据包列表"""
        self.buffer.extend(data)
        results = []
        while len(self.buffer) >= 6:
            # 查找同步头
            idx = self.buffer.find(b'\x5A\xA5')
            if idx < 0:
                self.buffer.clear()
                break
            if idx > 0:
                self.buffer = self.buffer[idx:]

            if len(self.buffer) < 6:
                break

            payload_len = struct.unpack_from('<H', self.buffer, 2)[0]
            total_len = 6 + payload_len
            if len(self.buffer) < total_len:
                break

            frame = bytes(self.buffer[:total_len])
            self.buffer = self.buffer[total_len:]

            # CRC 校验
            crc_data = frame[0:4] + frame[6:]
            crc_calc = crc16_update(0, crc_data)
            crc_recv = struct.unpack_from('<H', frame, 4)[0]
            if crc_calc != crc_recv:
                continue

            # 解析 HI91 子包
            payload = frame[6:]
            if len(payload) >= 76 and payload[0] == 0x91:
                results.append(self._parse_hi91(payload))

        return results

    def _parse_hi91(self, p: bytes) -> dict:
        acc_raw = struct.unpack_from('<3f', p, 12)
        return {
            'system_time': struct.unpack_from('<I', p, 8)[0],
            'temperature': struct.unpack_from('<b', p, 3)[0],
            'acc': [a * GRAVITY for a in acc_raw],  # m/s²
            'gyr': list(struct.unpack_from('<3f', p, 24)),  # °/s
            'mag': list(struct.unpack_from('<3f', p, 36)),  # μT
            'roll':  struct.unpack_from('<f', p, 48)[0],
            'pitch': struct.unpack_from('<f', p, 52)[0],
            'yaw':   struct.unpack_from('<f', p, 56)[0],
            'quat':  list(struct.unpack_from('<4f', p, 60)),  # (w,x,y,z)
        }
```

### Rust 实现参考

```rust
const GRAVITY: f64 = 9.80665;

// 逐字节喂入
pub fn input(&mut self, byte: u8) -> Option<Hi91Data> { ... }

// 批量喂入
pub fn input_bytes(&mut self, data: &[u8]) -> Vec<Hi91Data> {
    data.iter().filter_map(|&b| self.input(b)).collect()
}
```

完整实现见 `src-tauri/src/protocol.rs`。

---

## 5. 运动控制常用数据提取

### 姿态角（欧拉角）

```
roll  → 横滚  [-180, +180]°
pitch → 俯仰  [-90, +90]°
yaw   → 偏航  [-180, +180]°
```

直接读取 `roll`/`pitch`/`yaw` 字段即可，单位度。

### 四元数

```
quat = [w, x, y, z]
```

四元数无万向锁问题，推荐用于 3D 姿态控制。H12 输出的是 **ROS 坐标系（Z-up）** 下的四元数。

转换为旋转矩阵：

```python
def quat_to_rotation_matrix(w, x, y, z):
    return [
        [1-2*(y*y+z*z),   2*(x*y-w*z),   2*(x*z+w*y)],
        [2*(x*y+w*z),   1-2*(x*x+z*z),   2*(y*z-w*x)],
        [2*(x*z-w*y),     2*(y*z+w*x), 1-2*(x*x+y*y)],
    ]
```

### 加速度与角速度

| 字段 | 原始单位 | 运动控制常用单位 | 转换 |
|------|---------|-----------------|------|
| acc[3] | G | m/s² | `× 9.80665` |
| gyr[3] | °/s | rad/s | `× π/180` (≈ 0.01745329) |

### 典型数据频率

| 输出频率 | 周期 | 用途 |
|---------|------|------|
| 100 Hz | 10 ms | 普通姿态监测 |
| 200 Hz | 5 ms | 运动控制闭环 |
| 400 Hz | 2.5 ms | 高动态控制 |

频率可通过 AT 命令配置：`LOG HI91 ONTIME <秒>`，例如 200Hz → `LOG HI91 ONTIME 0.005`

---

## 6. 串口读取流程（伪代码）

```
# 初始化
serial = open("/dev/ttyUSB0", 115200, 8N1)
parser = HI91Parser()

# 主循环
while running:
    raw = serial.read(256)         # 读取串口缓冲区
    packets = parser.feed(raw)     # 喂入解析器
    for pkt in packets:
        # 提取运动控制所需数据
        acc_ms2   = pkt['acc']     # [ax, ay, az] m/s²
        gyr_dps   = pkt['gyr']     # [gx, gy, gz] °/s
        roll_deg  = pkt['roll']    # °
        pitch_deg = pkt['pitch']   # °
        yaw_deg   = pkt['yaw']     # °
        quat_wxyz = pkt['quat']    # [w, x, y, z]
        timestamp = pkt['system_time']  # ms

        # 送入运动控制层
        motion_controller.update_imu(acc_ms2, gyr_dps, quat_wxyz, timestamp)
```

---

## 7. 验证用测试帧

以下是一帧完整的 HI91 数据（82 字节 = 6 头 + 76 Payload），可用于验证解析器正确性：

```
5A A5 4C 00 14 BB 91 08 15 23 09 A2 C4 47 08 15 1C 00
CC E8 61 BE 9A 35 56 3E 65 EA 72 3F 31 D0 7C BD 75 DD
C5 BB 6B D7 24 BC 89 88 FC 40 01 00 6A 41 AB 2A 70 C2
96 D4 50 41 ED 03 43 41 41 F4 F4 C2 CC CA F8 BE 73 6A
19 BE F0 00 1C 3D 8D 37 5C 3F
```

预期解析结果：

| 字段 | 值 |
|------|-----|
| temperature | 35 °C |
| system_time | 1840392 ms |
| acc[0] | -2.163 m/s² |
| acc[1] | 2.051 m/s² |
| acc[2] | 9.305 m/s² |
| gyr[0] | -0.0617 °/s |
| roll | 13.052° |
| pitch | 12.188° |
| yaw | -122.477° |

---

## 8. 官方 SDK 参考源码

| 文件 | 语言 | 说明 |
|------|------|------|
| `drivers/hipnuc_dec.c` + `.h` | C | 官方解码库（状态机 + CRC + HI91/HI81/HI83 解析） |
| `examples/python/parsers/hipnuc_serial_parser.py` | Python | 串口读取 + 解析完整示例 |
| `examples/stm32_serial/` | C (STM32) | 嵌入式串口解析示例 |
| `examples/ROS2/hipnuc_ws/` | C++ | ROS2 节点集成示例 |
| `examples/arduino/` | C | Arduino 平台解析示例 |

H12 系列仅用到 **HI91 (0x91)** 包。HI81/HI83 为 GNSS/INS 组合导航模块使用，H12 不涉及。
