/// HiPNUC binary protocol parser
///
/// Frame format:
///   [0x5A] [0xA5] [len_lo] [len_hi] [crc_lo] [crc_hi] [payload...]
///
/// CRC16-CCITT (poly 0x1021, init 0) over bytes[0..4] + payload (excludes CRC field)
///
/// HI91 payload (76 bytes): tag(0x91) + main_status + temp + pressure + time + acc[3] + gyr[3] + mag[3] + roll + pitch + yaw + quat[4]

use serde::Serialize;

// Protocol constants
const CHSYNC1: u8 = 0x5A;
const CHSYNC2: u8 = 0xA5;
const CH_HDR_SIZE: usize = 6;
const HIPNUC_MAX_RAW_SIZE: usize = 512;

const FRAME_TAG_HI91: u8 = 0x91;

/// CRC16-CCITT with polynomial 0x1021, initial value 0
/// Matches the reference C implementation in hipnuc_dec.c
pub fn crc16_update(crc: u16, data: &[u8]) -> u16 {
    let mut crc = crc;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            let temp = crc << 1;
            if crc & 0x8000 != 0 {
                crc = temp ^ 0x1021;
            } else {
                crc = temp;
            }
        }
    }
    crc & 0xFFFF
}

/// Parsed HI91 IMU data packet
#[derive(Debug, Clone, Serialize, Default)]
pub struct Hi91Data {
    /// Accelerometer X/Y/Z in m/s^2 (converted from G)
    pub acc: [f64; 3],
    /// Gyroscope X/Y/Z in deg/s
    pub gyr: [f64; 3],
    /// Magnetometer X/Y/Z in uT
    pub mag: [f64; 3],
    /// Roll angle in degrees
    pub roll: f64,
    /// Pitch angle in degrees
    pub pitch: f64,
    /// Yaw angle in degrees
    pub yaw: f64,
    /// Quaternion (w, x, y, z)
    pub quat: [f64; 4],
    /// Temperature in degrees Celsius
    pub temperature: i8,
    /// Air pressure in Pa
    pub air_pressure: f64,
    /// System timestamp in ms
    pub system_time: u32,
}

const GRAVITY: f64 = 9.80665;

/// Parse HI91 payload (76 bytes starting with tag 0x91)
/// Layout matches reference: hipnuc_dec.h hi91_t struct
fn parse_hi91(data: &[u8]) -> Option<Hi91Data> {
    if data.len() < 76 {
        return None;
    }
    if data[0] != FRAME_TAG_HI91 {
        return None;
    }

    let _main_status = u16::from_le_bytes([data[1], data[2]]);
    let temperature = data[3] as i8;
    let air_pressure = f32::from_le_bytes([data[4], data[5], data[6], data[7]]) as f64;
    let system_time = u32::from_le_bytes([data[8], data[9], data[10], data[11]]);

    // Accelerometer: 3x f32 at offset 12, unit is G, convert to m/s^2
    let acc_x = f32::from_le_bytes([data[12], data[13], data[14], data[15]]) as f64 * GRAVITY;
    let acc_y = f32::from_le_bytes([data[16], data[17], data[18], data[19]]) as f64 * GRAVITY;
    let acc_z = f32::from_le_bytes([data[20], data[21], data[22], data[23]]) as f64 * GRAVITY;

    // Gyroscope: 3x f32 at offset 24, unit is deg/s
    let gyr_x = f32::from_le_bytes([data[24], data[25], data[26], data[27]]) as f64;
    let gyr_y = f32::from_le_bytes([data[28], data[29], data[30], data[31]]) as f64;
    let gyr_z = f32::from_le_bytes([data[32], data[33], data[34], data[35]]) as f64;

    // Magnetometer: 3x f32 at offset 36, unit is uT
    let mag_x = f32::from_le_bytes([data[36], data[37], data[38], data[39]]) as f64;
    let mag_y = f32::from_le_bytes([data[40], data[41], data[42], data[43]]) as f64;
    let mag_z = f32::from_le_bytes([data[44], data[45], data[46], data[47]]) as f64;

    // Euler angles: f32 at offsets 48, 52, 56
    let roll = f32::from_le_bytes([data[48], data[49], data[50], data[51]]) as f64;
    let pitch = f32::from_le_bytes([data[52], data[53], data[54], data[55]]) as f64;
    let yaw = f32::from_le_bytes([data[56], data[57], data[58], data[59]]) as f64;

    // Quaternion: 4x f32 at offset 60 (w, x, y, z)
    let qw = f32::from_le_bytes([data[60], data[61], data[62], data[63]]) as f64;
    let qx = f32::from_le_bytes([data[64], data[65], data[66], data[67]]) as f64;
    let qy = f32::from_le_bytes([data[68], data[69], data[70], data[71]]) as f64;
    let qz = f32::from_le_bytes([data[72], data[73], data[74], data[75]]) as f64;

    Some(Hi91Data {
        acc: [acc_x, acc_y, acc_z],
        gyr: [gyr_x, gyr_y, gyr_z],
        mag: [mag_x, mag_y, mag_z],
        roll,
        pitch,
        yaw,
        quat: [qw, qx, qy, qz],
        temperature,
        air_pressure,
        system_time,
    })
}

/// Decoder state machine
#[derive(Debug, Clone, Copy, PartialEq)]
enum DecoderState {
    WaitSync1,
    WaitSync2,
    ReadHeader,
    ReadPayload,
}

/// Byte-by-byte streaming protocol decoder
/// Matches the state machine in hipnuc_dec.c hipnuc_input()
pub struct HipnucDecoder {
    state: DecoderState,
    buf: [u8; HIPNUC_MAX_RAW_SIZE],
    nbyte: usize,
    payload_len: usize,
}

impl HipnucDecoder {
    pub fn new() -> Self {
        Self {
            state: DecoderState::WaitSync1,
            buf: [0u8; HIPNUC_MAX_RAW_SIZE],
            nbyte: 0,
            payload_len: 0,
        }
    }

    /// Feed one byte into the decoder.
    /// Returns Some(Hi91Data) when a complete valid HI91 frame is decoded.
    pub fn input(&mut self, byte: u8) -> Option<Hi91Data> {
        match self.state {
            DecoderState::WaitSync1 => {
                if byte == CHSYNC1 {
                    self.buf[0] = byte;
                    self.nbyte = 1;
                    self.state = DecoderState::WaitSync2;
                }
                None
            }
            DecoderState::WaitSync2 => {
                if byte == CHSYNC2 {
                    self.buf[1] = byte;
                    self.nbyte = 2;
                    self.state = DecoderState::ReadHeader;
                } else {
                    // Not sync2, reset
                    self.state = DecoderState::WaitSync1;
                    self.nbyte = 0;
                }
                None
            }
            DecoderState::ReadHeader => {
                self.buf[self.nbyte] = byte;
                self.nbyte += 1;

                if self.nbyte >= CH_HDR_SIZE {
                    // Header complete: extract payload length (bytes 2-3, little-endian)
                    self.payload_len =
                        u16::from_le_bytes([self.buf[2], self.buf[3]]) as usize;

                    // Sanity check
                    if self.payload_len == 0
                        || CH_HDR_SIZE + self.payload_len > HIPNUC_MAX_RAW_SIZE
                    {
                        self.reset();
                        return None;
                    }

                    self.state = DecoderState::ReadPayload;
                }
                None
            }
            DecoderState::ReadPayload => {
                self.buf[self.nbyte] = byte;
                self.nbyte += 1;

                if self.nbyte >= CH_HDR_SIZE + self.payload_len {
                    // Frame complete, validate CRC
                    let result = self.validate_and_parse();
                    self.reset();
                    result
                } else {
                    None
                }
            }
        }
    }

    /// Feed a buffer of bytes, collecting all parsed packets
    pub fn input_bytes(&mut self, data: &[u8]) -> Vec<Hi91Data> {
        let mut results = Vec::new();
        for &byte in data {
            if let Some(packet) = self.input(byte) {
                results.push(packet);
            }
        }
        results
    }

    fn validate_and_parse(&self) -> Option<Hi91Data> {
        let total_len = CH_HDR_SIZE + self.payload_len;

        // CRC16 is over bytes[0..4] (sync1, sync2, len_lo, len_hi) + payload[6..]
        // i.e., everything except bytes[4..6] (the CRC field itself)
        let mut crc_data = Vec::with_capacity(4 + self.payload_len);
        crc_data.extend_from_slice(&self.buf[0..4]);
        crc_data.extend_from_slice(&self.buf[CH_HDR_SIZE..total_len]);

        let crc_calculated = crc16_update(0, &crc_data);
        let crc_received = u16::from_le_bytes([self.buf[4], self.buf[5]]);

        if crc_calculated != crc_received {
            log::warn!(
                "CRC mismatch: calculated=0x{:04X}, received=0x{:04X}",
                crc_calculated,
                crc_received
            );
            return None;
        }

        // Parse payload sub-packets
        let payload = &self.buf[CH_HDR_SIZE..total_len];
        self.parse_payload(payload)
    }

    fn parse_payload(&self, payload: &[u8]) -> Option<Hi91Data> {
        let offset = 0;
        while offset < payload.len() {
            let tag = payload[offset];
            match tag {
                FRAME_TAG_HI91 => {
                    if offset + 76 <= payload.len() {
                        return parse_hi91(&payload[offset..]);
                    } else {
                        return None;
                    }
                }
                _ => {
                    // Unknown tag or other packet types (HI81/HI83) - skip
                    // For HI12 we only expect HI91
                    break;
                }
            }
        }
        None
    }

    fn reset(&mut self) {
        self.state = DecoderState::WaitSync1;
        self.nbyte = 0;
        self.payload_len = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test CRC16 against the reference Python implementation
    #[test]
    fn test_crc16() {
        // From the Python example data for HI91
        let frame = hex_to_bytes(
            "5A A5 4C 00 14 BB 91 08 15 23 09 A2 C4 47 08 15 1C 00 \
             CC E8 61 BE 9A 35 56 3E 65 EA 72 3F 31 D0 7C BD 75 DD \
             C5 BB 6B D7 24 BC 89 88 FC 40 01 00 6A 41 AB 2A 70 C2 \
             96 D4 50 41 ED 03 43 41 41 F4 F4 C2 CC CA F8 BE 73 6A \
             19 BE F0 00 1C 3D 8D 37 5C 3F",
        );

        // CRC is over bytes[0..4] + bytes[6..]
        let mut crc_input = Vec::new();
        crc_input.extend_from_slice(&frame[0..4]);
        crc_input.extend_from_slice(&frame[6..]);

        let crc = crc16_update(0, &crc_input);
        let crc_in_frame = u16::from_le_bytes([frame[4], frame[5]]);

        assert_eq!(crc, crc_in_frame, "CRC16 must match frame CRC");
    }

    /// Test full HI91 frame parsing with reference example data
    #[test]
    fn test_parse_hi91_frame() {
        let frame = hex_to_bytes(
            "5A A5 4C 00 14 BB 91 08 15 23 09 A2 C4 47 08 15 1C 00 \
             CC E8 61 BE 9A 35 56 3E 65 EA 72 3F 31 D0 7C BD 75 DD \
             C5 BB 6B D7 24 BC 89 88 FC 40 01 00 6A 41 AB 2A 70 C2 \
             96 D4 50 41 ED 03 43 41 41 F4 F4 C2 CC CA F8 BE 73 6A \
             19 BE F0 00 1C 3D 8D 37 5C 3F",
        );

        let mut decoder = HipnucDecoder::new();
        let packets = decoder.input_bytes(&frame);

        assert_eq!(packets.len(), 1, "Should parse exactly one HI91 packet");

        let p = &packets[0];

        // Verified by decoding the hex with Node.js against the same GRAVITY constant
        assert!(
            (p.acc[0] - (-2.1634902857750653)).abs() < 0.001,
            "acc[0] mismatch: {}",
            p.acc[0]
        );
        assert!(
            (p.acc[1] - 2.0514418234363196).abs() < 0.001,
            "acc[1] mismatch: {}",
            p.acc[1]
        );
        assert!(
            (p.acc[2] - 9.305423064115644).abs() < 0.001,
            "acc[2] mismatch: {}",
            p.acc[2]
        );

        assert!(
            (p.gyr[0] - (-0.061721984297037125)).abs() < 0.0001,
            "gyr[0] mismatch: {}",
            p.gyr[0]
        );

        assert!(
            (p.roll - 13.051900863647461).abs() < 0.001,
            "roll mismatch: {}",
            p.roll
        );
        assert!(
            (p.pitch - 12.188458442687988).abs() < 0.001,
            "pitch mismatch: {}",
            p.pitch
        );
        assert!(
            (p.yaw - (-122.47705841064453)).abs() < 0.001,
            "yaw mismatch: {}",
            p.yaw
        );

        assert_eq!(p.temperature, 35, "temperature mismatch");
        assert_eq!(p.system_time, 1840392, "system_time mismatch");
    }

    /// Test decoder handles garbage bytes and resynchronizes
    #[test]
    fn test_resync_after_garbage() {
        let garbage = vec![0x00, 0xFF, 0x12, 0x34, 0x5A, 0x00]; // garbage including a lone 0x5A
        let frame = hex_to_bytes(
            "5A A5 4C 00 14 BB 91 08 15 23 09 A2 C4 47 08 15 1C 00 \
             CC E8 61 BE 9A 35 56 3E 65 EA 72 3F 31 D0 7C BD 75 DD \
             C5 BB 6B D7 24 BC 89 88 FC 40 01 00 6A 41 AB 2A 70 C2 \
             96 D4 50 41 ED 03 43 41 41 F4 F4 C2 CC CA F8 BE 73 6A \
             19 BE F0 00 1C 3D 8D 37 5C 3F",
        );

        let mut data = garbage;
        data.extend_from_slice(&frame);

        let mut decoder = HipnucDecoder::new();
        let packets = decoder.input_bytes(&data);

        assert_eq!(packets.len(), 1, "Should still parse one packet after garbage");
    }

    /// Test that corrupted CRC is rejected
    #[test]
    fn test_crc_mismatch_rejected() {
        let mut frame = hex_to_bytes(
            "5A A5 4C 00 14 BB 91 08 15 23 09 A2 C4 47 08 15 1C 00 \
             CC E8 61 BE 9A 35 56 3E 65 EA 72 3F 31 D0 7C BD 75 DD \
             C5 BB 6B D7 24 BC 89 88 FC 40 01 00 6A 41 AB 2A 70 C2 \
             96 D4 50 41 ED 03 43 41 41 F4 F4 C2 CC CA F8 BE 73 6A \
             19 BE F0 00 1C 3D 8D 37 5C 3F",
        );
        // Corrupt one payload byte
        frame[10] ^= 0xFF;

        let mut decoder = HipnucDecoder::new();
        let packets = decoder.input_bytes(&frame);
        assert_eq!(packets.len(), 0, "Corrupted frame should be rejected");
    }

    /// Helper: convert hex string to bytes
    fn hex_to_bytes(hex: &str) -> Vec<u8> {
        hex.split_whitespace()
            .map(|s| u8::from_str_radix(s, 16).unwrap())
            .collect()
    }
}
