use serde::{Deserialize, Serialize};

// ── MIT mode parameter ranges ──────────────────────────────────────
pub const P_MIN: f32 = -12.57;
pub const P_MAX: f32 = 12.57;
pub const V_MIN: f32 = -33.0;
pub const V_MAX: f32 = 33.0;
pub const KP_MIN: f32 = 0.0;
pub const KP_MAX: f32 = 500.0;
pub const KD_MIN: f32 = 0.0;
pub const KD_MAX: f32 = 5.0;
pub const T_MIN: f32 = -14.0;
pub const T_MAX: f32 = 14.0;

// ── Waveshare 13-byte CAN-ETH transparent frame ────────────────────
pub const CAN_FRAME_SIZE: usize = 13;

/// Encode a float to uint with linear mapping
pub fn float_to_uint(x: f32, x_min: f32, x_max: f32, bits: u32) -> u32 {
    let span = x_max - x_min;
    let x_clamped = x.clamp(x_min, x_max);
    ((x_clamped - x_min) * (((1u32 << bits) - 1) as f32) / span) as u32
}

/// Decode uint to float with linear mapping
pub fn uint_to_float(x_int: u32, x_min: f32, x_max: f32, bits: u32) -> f32 {
    let span = x_max - x_min;
    (x_int as f32) * span / (((1u32 << bits) - 1) as f32) + x_min
}

// ── Waveshare frame builders ────────────────────────────────────────

/// Build a Waveshare 13-byte frame for a standard CAN data frame (11-bit ID, 8 bytes data)
pub fn build_can_frame(can_id: u16, data: &[u8; 8]) -> [u8; CAN_FRAME_SIZE] {
    let mut frame = [0u8; CAN_FRAME_SIZE];
    // frame_info: bit7=0 (standard), bit6=0 (data), DLC=8
    frame[0] = 0x08;
    // CAN ID in 4 bytes big-endian (standard frame uses lower 11 bits)
    frame[1] = 0;
    frame[2] = 0;
    frame[3] = (can_id >> 8) as u8;
    frame[4] = (can_id & 0xFF) as u8;
    frame[5..13].copy_from_slice(data);
    frame
}

/// Build a Waveshare 13-byte frame for an extended CAN data frame (29-bit ID, 8 bytes data)
pub fn build_ext_can_frame(ext_can_id: u32, data: &[u8; 8]) -> [u8; CAN_FRAME_SIZE] {
    let mut frame = [0u8; CAN_FRAME_SIZE];
    // frame_info: bit7=1 (extended), bit6=0 (data), DLC=8
    frame[0] = 0x88;
    // CAN ID in 4 bytes big-endian (29-bit extended ID)
    frame[1] = ((ext_can_id >> 24) & 0xFF) as u8;
    frame[2] = ((ext_can_id >> 16) & 0xFF) as u8;
    frame[3] = ((ext_can_id >> 8) & 0xFF) as u8;
    frame[4] = (ext_can_id & 0xFF) as u8;
    frame[5..13].copy_from_slice(data);
    frame
}

/// Parse a Waveshare 13-byte frame, returns (frame_info, can_id_32bit, data[8])
pub fn parse_can_frame(frame: &[u8; CAN_FRAME_SIZE]) -> (u8, u32, [u8; 8]) {
    let frame_info = frame[0];
    let can_id = ((frame[1] as u32) << 24)
        | ((frame[2] as u32) << 16)
        | ((frame[3] as u32) << 8)
        | (frame[4] as u32);
    let mut data = [0u8; 8];
    data.copy_from_slice(&frame[5..13]);
    (frame_info, can_id, data)
}

/// Check if a frame is a standard data frame
pub fn is_standard_data_frame(frame_info: u8) -> bool {
    frame_info & 0xC0 == 0
}

/// Check if a frame is an extended data frame
pub fn is_extended_data_frame(frame_info: u8) -> bool {
    (frame_info & 0xC0) == 0x80 // bit7=1, bit6=0
}

/// Compute the 11-bit CAN ID for MIT commands: mode(3-bit) | motor_id(8-bit)
pub fn make_can_id(mode: u8, motor_id: u8) -> u16 {
    ((mode as u16) << 8) | (motor_id as u16)
}

// ── Private protocol 29-bit extended CAN ID ─────────────────────────
//
// 29-bit ID layout:
//   bit[28:24] = comm_type (5-bit, communication type 0~31)
//   bit[23:8]  = data_area2 (16-bit, varies per command)
//   bit[7:0]   = target_id (8-bit, target motor CAN ID)
//

/// Build 29-bit extended CAN ID for private protocol
pub fn make_ext_can_id(comm_type: u8, data_area2: u16, target_id: u8) -> u32 {
    ((comm_type as u32 & 0x1F) << 24)
        | ((data_area2 as u32) << 8)
        | (target_id as u32)
}

/// Parse 29-bit extended CAN ID from private protocol response
pub fn parse_ext_can_id(ext_id: u32) -> (u8, u16, u8) {
    let comm_type = ((ext_id >> 24) & 0x1F) as u8;
    let data_area2 = ((ext_id >> 8) & 0xFFFF) as u16;
    let target_id = (ext_id & 0xFF) as u8;
    (comm_type, data_area2, target_id)
}

// ── Motor feedback from MIT response command 1 ──────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct MotorFeedback {
    pub motor_id: u8,
    pub angle: f32,    // rad
    pub velocity: f32, // rad/s
    pub torque: f32,   // N.m
    pub temperature: f32, // °C
}

/// Decode MIT response command 1 (status feedback) from 8-byte CAN data
pub fn decode_feedback(data: &[u8; 8]) -> MotorFeedback {
    let motor_id = data[0];
    let angle_u = ((data[1] as u32) << 8) | (data[2] as u32);
    let vel_u = ((data[3] as u32) << 4) | ((data[4] as u32) >> 4);
    let torq_u = (((data[4] & 0x0F) as u32) << 8) | (data[5] as u32);
    let temp_u = ((data[6] as u16) << 8) | (data[7] as u16);

    MotorFeedback {
        motor_id,
        angle: uint_to_float(angle_u, P_MIN, P_MAX, 16),
        velocity: uint_to_float(vel_u, V_MIN, V_MAX, 12),
        torque: uint_to_float(torq_u, T_MIN, T_MAX, 12),
        temperature: (temp_u as f32) / 10.0,
    }
}

// ── Private protocol feedback (communication type 2) ────────────────
//
// Extended CAN ID data_area2 encodes:
//   bit[15:8] = motor CAN ID
//   bit[21:16] = fault bits (6 bits)
//   bit[23:22] = mode status (0=Reset, 1=Cali, 2=Motor)
//
// Data bytes (16-bit each, high byte first):
//   Byte0~1: angle [0~65535] → (-12.57~12.57 rad)
//   Byte2~3: velocity [0~65535] → (-33~33 rad/s)
//   Byte4~5: torque [0~65535] → (-14~14 N.m)
//   Byte6~7: temperature × 10

#[derive(Debug, Clone, Serialize)]
pub struct PrivateFeedback {
    pub motor_id: u8,
    pub mode_status: u8,  // 0=Reset, 1=Cali, 2=Motor
    pub fault_bits: u8,   // 6-bit fault summary from CAN ID
    pub angle: f32,
    pub velocity: f32,
    pub torque: f32,
    pub temperature: f32,
}

/// Decode private protocol type 2 feedback
pub fn decode_private_feedback(data_area2: u16, data: &[u8; 8]) -> PrivateFeedback {
    let motor_id = ((data_area2 >> 0) & 0xFF) as u8;
    let fault_bits = ((data_area2 >> 8) & 0x3F) as u8;
    let mode_status = ((data_area2 >> 14) & 0x03) as u8;

    let angle_u = ((data[0] as u32) << 8) | (data[1] as u32);
    let vel_u = ((data[2] as u32) << 8) | (data[3] as u32);
    let torq_u = ((data[4] as u32) << 8) | (data[5] as u32);
    let temp_u = ((data[6] as u16) << 8) | (data[7] as u16);

    PrivateFeedback {
        motor_id,
        mode_status,
        fault_bits,
        angle: uint_to_float(angle_u, P_MIN, P_MAX, 16),
        velocity: uint_to_float(vel_u, V_MIN, V_MAX, 16),
        torque: uint_to_float(torq_u, T_MIN, T_MAX, 16),
        temperature: (temp_u as f32) / 10.0,
    }
}

// ── Fault bits ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct FaultStatus {
    pub raw: u32,
    pub faults: Vec<String>,
}

pub fn decode_faults(fault_word: u32) -> FaultStatus {
    let fault_table: &[(u32, &str)] = &[
        (0, "Over-temperature (>145°C)"),
        (1, "Driver chip fault"),
        (2, "Under-voltage (<12V)"),
        (3, "Over-voltage (>60V)"),
        (4, "Phase B overcurrent"),
        (5, "Phase C overcurrent"),
        (7, "Encoder not calibrated"),
        (8, "Hardware identification fault"),
        (9, "Position init fault"),
        (14, "Stall overload protection"),
        (16, "Phase A overcurrent"),
    ];
    let mut faults = Vec::new();
    for &(bit, name) in fault_table {
        if fault_word & (1 << bit) != 0 {
            faults.push(name.to_string());
        }
    }
    FaultStatus {
        raw: fault_word,
        faults,
    }
}

// ── MIT Command builders (return 8-byte CAN data) ──────────────────

/// Command 1: Enable motor. Data: FF FF FF FF FF FF FF FC
pub fn cmd_enable() -> [u8; 8] {
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFC]
}

/// Command 2: Stop motor. Data: FF FF FF FF FF FF FF FD
pub fn cmd_stop() -> [u8; 8] {
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFD]
}

/// Command 3: MIT 5-parameter control
pub fn cmd_mit_params(position: f32, velocity: f32, kp: f32, kd: f32, torque: f32) -> [u8; 8] {
    let pos_u = float_to_uint(position, P_MIN, P_MAX, 16) as u16;
    let vel_u = float_to_uint(velocity, V_MIN, V_MAX, 12) as u16;
    let kp_u = float_to_uint(kp, KP_MIN, KP_MAX, 12) as u16;
    let kd_u = float_to_uint(kd, KD_MIN, KD_MAX, 12) as u16;
    let torq_u = float_to_uint(torque, T_MIN, T_MAX, 12) as u16;

    let mut data = [0u8; 8];
    data[0] = (pos_u >> 8) as u8;
    data[1] = (pos_u & 0xFF) as u8;
    data[2] = (vel_u >> 4) as u8;
    data[3] = ((vel_u & 0xF) << 4) as u8 | ((kp_u >> 8) & 0xF) as u8;
    data[4] = (kp_u & 0xFF) as u8;
    data[5] = (kd_u >> 4) as u8;
    data[6] = ((kd_u & 0xF) << 4) as u8 | ((torq_u >> 8) & 0xF) as u8;
    data[7] = (torq_u & 0xFF) as u8;
    data
}

/// Command 4: Set zero point. Data: FF FF FF FF FF FF FF FE
pub fn cmd_set_zero() -> [u8; 8] {
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFE]
}

/// Command 5: Clear faults (f_cmd=0xFF) or read faults (f_cmd=other)
pub fn cmd_clear_or_read_fault(f_cmd: u8) -> [u8; 8] {
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, f_cmd, 0xFB]
}

/// Command 6: Set run mode (0=MIT, 1=Position/CSP, 2=Speed)
pub fn cmd_set_mode(mode: u8) -> [u8; 8] {
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, mode, 0xFC]
}

/// Command 7: Change motor CAN ID
pub fn cmd_change_motor_id(new_id: u8) -> [u8; 8] {
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, new_id, 0xFA]
}

/// Command 8: Change protocol (0=Private, 1=CANopen, 2=MIT). Needs power cycle.
pub fn cmd_change_protocol(protocol: u8) -> [u8; 8] {
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, protocol, 0xFD]
}

/// Command 9: Change master CAN ID
pub fn cmd_change_master_id(new_master_id: u8) -> [u8; 8] {
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFD, new_master_id]
}

/// Command 10: Position mode control (mode=1 in CAN ID)
/// data[0..4] = target_position (f32 IEEE754 LE), data[4..8] = max_speed (f32 IEEE754 LE)
pub fn cmd_position(target_pos: f32, max_speed: f32) -> [u8; 8] {
    let mut data = [0u8; 8];
    data[0..4].copy_from_slice(&target_pos.to_le_bytes());
    data[4..8].copy_from_slice(&max_speed.to_le_bytes());
    data
}

/// Command 11: Speed mode control (mode=2 in CAN ID)
/// data[0..4] = target_speed (f32 IEEE754 LE), data[4..8] = current_limit (f32 IEEE754 LE)
pub fn cmd_speed(target_speed: f32, current_limit: f32) -> [u8; 8] {
    let mut data = [0u8; 8];
    data[0..4].copy_from_slice(&target_speed.to_le_bytes());
    data[4..8].copy_from_slice(&current_limit.to_le_bytes());
    data
}

// ── Private protocol command builders (extended frame) ──────────────

/// Private protocol type 0: Get device ID
/// Returns 64-bit MCU unique identifier
pub fn priv_cmd_get_device_id(master_id: u8, motor_id: u8) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0, (master_id as u16) << 8, motor_id);
    let data = [0u8; 8];
    (ext_id, data)
}

/// Private protocol type 3: Enable motor
pub fn priv_cmd_enable(master_id: u8, motor_id: u8) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(3, (master_id as u16) << 8, motor_id);
    let data = [0u8; 8];
    (ext_id, data)
}

/// Private protocol type 4: Stop motor
/// Byte[0]=1 means clear fault
pub fn priv_cmd_stop(master_id: u8, motor_id: u8, clear_fault: bool) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(4, (master_id as u16) << 8, motor_id);
    let mut data = [0u8; 8];
    if clear_fault {
        data[0] = 1;
    }
    (ext_id, data)
}

/// Private protocol type 6: Set mechanical zero
pub fn priv_cmd_set_zero(master_id: u8, motor_id: u8) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(6, (master_id as u16) << 8, motor_id);
    let mut data = [0u8; 8];
    data[0] = 1;
    (ext_id, data)
}

/// Private protocol type 7: Set motor CAN ID
/// data_area2 bit[16:23] = new CAN ID
pub fn priv_cmd_set_can_id(master_id: u8, motor_id: u8, new_id: u8) -> (u32, [u8; 8]) {
    let data_area2 = ((new_id as u16) << 8) | (master_id as u16);
    let ext_id = make_ext_can_id(7, data_area2, motor_id);
    let data = [0u8; 8];
    (ext_id, data)
}

/// Private protocol type 17 (0x11): Read single parameter
/// Byte0~1 = index (little-endian)
pub fn priv_cmd_param_read(master_id: u8, motor_id: u8, index: u16) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x11, (master_id as u16) << 8, motor_id);
    let mut data = [0u8; 8];
    // index in little-endian
    data[0] = (index & 0xFF) as u8;
    data[1] = (index >> 8) as u8;
    (ext_id, data)
}

/// Private protocol type 18 (0x12): Write single parameter (volatile, lost on power cycle)
/// Byte0~1 = index (LE), Byte4~7 = value (LE)
pub fn priv_cmd_param_write_u8(master_id: u8, motor_id: u8, index: u16, value: u8) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x12, (master_id as u16) << 8, motor_id);
    let mut data = [0u8; 8];
    data[0] = (index & 0xFF) as u8;
    data[1] = (index >> 8) as u8;
    data[4] = value;
    (ext_id, data)
}

pub fn priv_cmd_param_write_u16(master_id: u8, motor_id: u8, index: u16, value: u16) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x12, (master_id as u16) << 8, motor_id);
    let mut data = [0u8; 8];
    data[0] = (index & 0xFF) as u8;
    data[1] = (index >> 8) as u8;
    data[4] = (value & 0xFF) as u8;
    data[5] = (value >> 8) as u8;
    (ext_id, data)
}

pub fn priv_cmd_param_write_u32(master_id: u8, motor_id: u8, index: u16, value: u32) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x12, (master_id as u16) << 8, motor_id);
    let mut data = [0u8; 8];
    data[0] = (index & 0xFF) as u8;
    data[1] = (index >> 8) as u8;
    let bytes = value.to_le_bytes();
    data[4..8].copy_from_slice(&bytes);
    (ext_id, data)
}

pub fn priv_cmd_param_write_f32(master_id: u8, motor_id: u8, index: u16, value: f32) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x12, (master_id as u16) << 8, motor_id);
    let mut data = [0u8; 8];
    data[0] = (index & 0xFF) as u8;
    data[1] = (index >> 8) as u8;
    data[4..8].copy_from_slice(&value.to_le_bytes());
    (ext_id, data)
}

/// Private protocol type 21 (0x15): Request fault feedback
pub fn priv_cmd_fault_feedback(master_id: u8, motor_id: u8) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x15, (master_id as u16) << 8, motor_id);
    let data = [0u8; 8];
    (ext_id, data)
}

/// Private protocol type 22 (0x16): Save all parameters to flash
pub fn priv_cmd_save_params(master_id: u8, motor_id: u8) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x16, (master_id as u16) << 8, motor_id);
    let data = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];
    (ext_id, data)
}

/// Private protocol type 23 (0x17): Change baud rate (needs power cycle)
/// baud_code: 1=1M, 2=500K, 3=250K, 4=125K
pub fn priv_cmd_change_baud(master_id: u8, motor_id: u8, baud_code: u8) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x17, (master_id as u16) << 8, motor_id);
    let data = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, baud_code, 0x00];
    (ext_id, data)
}

/// Private protocol type 24 (0x18): Toggle active reporting
/// enable: 0=off, 1=on (default interval 10ms)
pub fn priv_cmd_active_report(master_id: u8, motor_id: u8, enable: u8) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x18, (master_id as u16) << 8, motor_id);
    let data = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, enable, 0x00];
    (ext_id, data)
}

/// Private protocol type 25 (0x19): Change protocol (needs power cycle)
/// protocol: 0=private (default), 1=CANopen, 2=MIT
pub fn priv_cmd_change_protocol(master_id: u8, motor_id: u8, protocol: u8) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x19, (master_id as u16) << 8, motor_id);
    let data = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, protocol, 0x00];
    (ext_id, data)
}

/// Private protocol type 26: Read version (via type 4 special command)
/// Byte[0]=0x00, Byte[1]=0xC4
pub fn priv_cmd_read_version(master_id: u8, motor_id: u8) -> (u32, [u8; 8]) {
    let ext_id = make_ext_can_id(0x04, (master_id as u16) << 8, motor_id);
    let mut data = [0u8; 8];
    data[0] = 0x00;
    data[1] = 0xC4;
    (ext_id, data)
}

// ── Parameter table definition ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ParamType {
    U8,
    U16,
    U32,
    I16,
    F32,
    Str,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ParamAccess {
    R,
    W,
    RW,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParamDef {
    pub index: u16,
    pub name: &'static str,
    pub desc: &'static str,
    pub param_type: ParamType,
    pub access: ParamAccess,
    pub default_str: &'static str,
}

/// Writable parameters accessible via private protocol type 17/18
/// Default values measured from RS00 motor (firmware 0.0.3.22)
pub static WRITABLE_PARAMS: &[ParamDef] = &[
    ParamDef { index: 0x7005, name: "run_mode",       desc: "Run mode (0=MIT,1=PP,2=Speed,3=Current,5=CSP)", param_type: ParamType::U8,  access: ParamAccess::RW, default_str: "0" },
    ParamDef { index: 0x7006, name: "iq_ref",         desc: "Current mode Iq command (A)",                   param_type: ParamType::F32, access: ParamAccess::RW, default_str: "0" },
    ParamDef { index: 0x700A, name: "spd_ref",        desc: "Speed command (rad/s)",                         param_type: ParamType::F32, access: ParamAccess::RW, default_str: "0" },
    ParamDef { index: 0x700B, name: "limit_torque",   desc: "Torque limit (N.m)",                            param_type: ParamType::F32, access: ParamAccess::RW, default_str: "14" },
    ParamDef { index: 0x7010, name: "cur_kp",         desc: "Current loop Kp",                               param_type: ParamType::F32, access: ParamAccess::RW, default_str: "0.125" },
    ParamDef { index: 0x7011, name: "cur_ki",         desc: "Current loop Ki",                               param_type: ParamType::F32, access: ParamAccess::RW, default_str: "0.0158" },
    ParamDef { index: 0x7014, name: "cur_filt_gain",  desc: "Current filter coefficient (0~1)",              param_type: ParamType::F32, access: ParamAccess::RW, default_str: "0.1" },
    ParamDef { index: 0x7016, name: "loc_ref",        desc: "Position command (rad)",                        param_type: ParamType::F32, access: ParamAccess::RW, default_str: "0" },
    ParamDef { index: 0x7017, name: "limit_spd",      desc: "CSP speed limit (rad/s)",                       param_type: ParamType::F32, access: ParamAccess::RW, default_str: "33" },
    ParamDef { index: 0x7018, name: "limit_cur",      desc: "Current limit (A)",                             param_type: ParamType::F32, access: ParamAccess::RW, default_str: "16" },
    ParamDef { index: 0x701E, name: "loc_kp",         desc: "Position loop Kp",                              param_type: ParamType::F32, access: ParamAccess::RW, default_str: "30" },
    ParamDef { index: 0x701F, name: "spd_kp",         desc: "Speed loop Kp",                                 param_type: ParamType::F32, access: ParamAccess::RW, default_str: "5" },
    ParamDef { index: 0x7020, name: "spd_ki",         desc: "Speed loop Ki",                                 param_type: ParamType::F32, access: ParamAccess::RW, default_str: "0.02" },
    ParamDef { index: 0x7021, name: "spd_filt_gain",  desc: "Speed filter coefficient (0~1)",                param_type: ParamType::F32, access: ParamAccess::RW, default_str: "0.05" },
    ParamDef { index: 0x7022, name: "acc_rad",        desc: "Speed mode acceleration (rad/s^2)",             param_type: ParamType::F32, access: ParamAccess::RW, default_str: "100" },
    ParamDef { index: 0x7024, name: "vel_max",        desc: "PP mode velocity (rad/s)",                      param_type: ParamType::F32, access: ParamAccess::RW, default_str: "10" },
    ParamDef { index: 0x7025, name: "acc_set",        desc: "PP mode acceleration (rad/s^2)",                param_type: ParamType::F32, access: ParamAccess::RW, default_str: "10" },
    ParamDef { index: 0x7026, name: "EPScan_time",    desc: "Report interval (1=10ms, +1 adds 5ms)",        param_type: ParamType::U16, access: ParamAccess::RW, default_str: "1" },
    ParamDef { index: 0x7028, name: "canTimeout",     desc: "CAN timeout (20000=1s, 0=disabled)",            param_type: ParamType::U32, access: ParamAccess::RW, default_str: "0" },
    ParamDef { index: 0x7029, name: "zero_sta",       desc: "Zero mode (0=0~2pi, 1=-pi~pi)",                 param_type: ParamType::U8,  access: ParamAccess::RW, default_str: "0" },
    ParamDef { index: 0x702A, name: "damper",         desc: "Damper switch (0=on, 1=off)",                   param_type: ParamType::U8,  access: ParamAccess::RW, default_str: "0" },
    ParamDef { index: 0x702B, name: "add_offset",     desc: "Zero offset (rad)",                             param_type: ParamType::F32, access: ParamAccess::RW, default_str: "0" },
];

/// Key read-only parameters (0x3xxx index space)
/// NOTE: These may return ERR on firmware versions below 0.0.3.5.
/// Full parameter read support requires firmware >= 0.0.3.5.
/// Real-time observation data is also available via type 2 feedback frames.
pub static READONLY_PARAMS: &[ParamDef] = &[
    ParamDef { index: 0x3005, name: "mcuTemp",      desc: "MCU temperature (*10)",           param_type: ParamType::I16, access: ParamAccess::R, default_str: "" },
    ParamDef { index: 0x3006, name: "motorTemp",     desc: "Motor NTC temperature (*10)",     param_type: ParamType::I16, access: ParamAccess::R, default_str: "" },
    ParamDef { index: 0x3007, name: "vBus_mv",       desc: "Bus voltage (mV)",                param_type: ParamType::U16, access: ParamAccess::R, default_str: "" },
    ParamDef { index: 0x300C, name: "VBUS",          desc: "Bus voltage (V)",                 param_type: ParamType::F32, access: ParamAccess::R, default_str: "" },
    ParamDef { index: 0x300E, name: "cmdIq",         desc: "Iq command (A)",                  param_type: ParamType::F32, access: ParamAccess::R, default_str: "" },
    ParamDef { index: 0x3015, name: "modPos",        desc: "Single-turn angle (rad)",         param_type: ParamType::F32, access: ParamAccess::R, default_str: "" },
    ParamDef { index: 0x3016, name: "mechPos",       desc: "Multi-turn position (rad)",       param_type: ParamType::F32, access: ParamAccess::R, default_str: "" },
    ParamDef { index: 0x3017, name: "mechVel",       desc: "Load-side velocity (rad/s)",      param_type: ParamType::F32, access: ParamAccess::R, default_str: "" },
    ParamDef { index: 0x301E, name: "iqf",           desc: "Filtered Iq (A)",                 param_type: ParamType::F32, access: ParamAccess::R, default_str: "" },
    ParamDef { index: 0x3022, name: "faultSta",      desc: "Fault status word",               param_type: ParamType::U32, access: ParamAccess::R, default_str: "" },
    ParamDef { index: 0x302C, name: "torque_fdb",    desc: "Torque feedback (N.m)",           param_type: ParamType::F32, access: ParamAccess::R, default_str: "" },
];

/// Parse a parameter read response (type 17 reply).
/// Data layout: Byte0~1 = index (LE), Byte2~3 = 0, Byte4~7 = value (LE)
/// data_area2 bit[23:16]: 0x00 = success, 0x01 = failure
#[derive(Debug, Clone, Serialize)]
pub struct ParamReadResponse {
    pub index: u16,
    pub success: bool,
    pub value_bytes: [u8; 4],
    pub value_f32: f32,
    pub value_u32: u32,
}

pub fn decode_param_read_response(data_area2: u16, data: &[u8; 8]) -> ParamReadResponse {
    let index = (data[0] as u16) | ((data[1] as u16) << 8);
    let success = ((data_area2 >> 8) & 0xFF) == 0x00;
    let mut value_bytes = [0u8; 4];
    value_bytes.copy_from_slice(&data[4..8]);
    let value_u32 = u32::from_le_bytes(value_bytes);
    let value_f32 = f32::from_le_bytes(value_bytes);
    ParamReadResponse {
        index,
        success,
        value_bytes,
        value_f32,
        value_u32,
    }
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_float_to_uint_and_back() {
        let u = float_to_uint(0.0, P_MIN, P_MAX, 16);
        let back = uint_to_float(u, P_MIN, P_MAX, 16);
        assert!((back - 0.0).abs() < 0.001, "got {}", back);

        let u = float_to_uint(P_MAX, P_MIN, P_MAX, 16);
        assert_eq!(u, 65535);

        let u = float_to_uint(P_MIN, P_MIN, P_MAX, 16);
        assert_eq!(u, 0);
    }

    #[test]
    fn test_float_to_uint_clamping() {
        let u = float_to_uint(100.0, P_MIN, P_MAX, 16);
        assert_eq!(u, 65535);
        let u = float_to_uint(-100.0, P_MIN, P_MAX, 16);
        assert_eq!(u, 0);
    }

    #[test]
    fn test_cmd_enable() {
        let data = cmd_enable();
        assert_eq!(data, [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFC]);
    }

    #[test]
    fn test_cmd_stop() {
        let data = cmd_stop();
        assert_eq!(data, [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFD]);
    }

    #[test]
    fn test_cmd_set_mode_vs_enable_distinction() {
        let enable = cmd_enable();
        let mode = cmd_set_mode(0);
        assert_eq!(enable[7], mode[7]);
        assert_ne!(enable[6], mode[6]);
    }

    #[test]
    fn test_cmd_stop_vs_change_protocol_distinction() {
        let stop = cmd_stop();
        let proto = cmd_change_protocol(2);
        assert_eq!(stop[7], proto[7]);
        assert_ne!(stop[6], proto[6]);
    }

    #[test]
    fn test_mit_params_encode_decode_roundtrip() {
        let pos = 1.0_f32;
        let vel = 2.0_f32;
        let kp = 50.0_f32;
        let kd = 1.0_f32;
        let torq = 3.0_f32;
        let data = cmd_mit_params(pos, vel, kp, kd, torq);

        let pos_u = ((data[0] as u32) << 8) | (data[1] as u32);
        let vel_u = ((data[2] as u32) << 4) | ((data[3] as u32) >> 4);
        let kp_u = (((data[3] & 0x0F) as u32) << 8) | (data[4] as u32);
        let kd_u = ((data[5] as u32) << 4) | ((data[6] as u32) >> 4);
        let torq_u = (((data[6] & 0x0F) as u32) << 8) | (data[7] as u32);

        let pos_back = uint_to_float(pos_u, P_MIN, P_MAX, 16);
        let vel_back = uint_to_float(vel_u, V_MIN, V_MAX, 12);
        let kp_back = uint_to_float(kp_u, KP_MIN, KP_MAX, 12);
        let kd_back = uint_to_float(kd_u, KD_MIN, KD_MAX, 12);
        let torq_back = uint_to_float(torq_u, T_MIN, T_MAX, 12);

        assert!((pos_back - pos).abs() < 0.01);
        assert!((vel_back - vel).abs() < 0.05);
        assert!((kp_back - kp).abs() < 0.5);
        assert!((kd_back - kd).abs() < 0.01);
        assert!((torq_back - torq).abs() < 0.05);
    }

    #[test]
    fn test_decode_feedback() {
        let angle_u: u16 = 32767;
        let vel_u: u16 = 2048;
        let torq_u: u16 = 2048;
        let temp_u: u16 = 250;

        let mut data = [0u8; 8];
        data[0] = 1;
        data[1] = (angle_u >> 8) as u8;
        data[2] = (angle_u & 0xFF) as u8;
        data[3] = (vel_u >> 4) as u8;
        data[4] = ((vel_u & 0xF) << 4) as u8 | ((torq_u >> 8) & 0xF) as u8;
        data[5] = (torq_u & 0xFF) as u8;
        data[6] = (temp_u >> 8) as u8;
        data[7] = (temp_u & 0xFF) as u8;

        let fb = decode_feedback(&data);
        assert_eq!(fb.motor_id, 1);
        assert!(fb.angle.abs() < 0.01);
        assert!(fb.velocity.abs() < 0.05);
        assert!(fb.torque.abs() < 0.05);
        assert!((fb.temperature - 25.0).abs() < 0.01);
    }

    #[test]
    fn test_decode_faults() {
        let fs = decode_faults(0b00000000_00000101);
        assert_eq!(fs.raw, 5);
        assert_eq!(fs.faults.len(), 2);
        assert!(fs.faults.iter().any(|f| f.contains("Over-temperature")));
        assert!(fs.faults.iter().any(|f| f.contains("Under-voltage")));
    }

    #[test]
    fn test_build_can_frame_standard() {
        let can_id = make_can_id(0, 1);
        let data = cmd_enable();
        let frame = build_can_frame(can_id, &data);
        assert_eq!(frame[0], 0x08);
        assert_eq!(frame[1], 0x00);
        assert_eq!(frame[2], 0x00);
        assert_eq!(frame[3], 0x00);
        assert_eq!(frame[4], 0x01);
        assert_eq!(&frame[5..13], &data);
    }

    #[test]
    fn test_parse_can_frame_roundtrip() {
        let can_id = make_can_id(1, 5);
        let data = cmd_position(1.0, 2.0);
        let frame = build_can_frame(can_id, &data);
        let (info, parsed_id, parsed_data) = parse_can_frame(&frame);
        assert_eq!(info, 0x08);
        assert_eq!(parsed_id, 0x105);
        assert_eq!(parsed_data, data);
    }

    #[test]
    fn test_build_ext_can_frame() {
        let ext_id = make_ext_can_id(0x12, 0x00FD, 0x01);
        let data = [0x1E, 0x70, 0x00, 0x00, 0x00, 0x00, 0xF0, 0x41];
        let frame = build_ext_can_frame(ext_id, &data);

        assert_eq!(frame[0], 0x88); // extended, data, DLC=8
        // ext_id = 0x1200FD01
        assert_eq!(frame[1], 0x12);
        assert_eq!(frame[2], 0x00);
        assert_eq!(frame[3], 0xFD);
        assert_eq!(frame[4], 0x01);
        assert_eq!(&frame[5..13], &data);
    }

    #[test]
    fn test_ext_can_id_roundtrip() {
        let ext_id = make_ext_can_id(0x12, 0x00FD, 0x7F);
        let (comm_type, data_area2, target_id) = parse_ext_can_id(ext_id);
        assert_eq!(comm_type, 0x12);
        assert_eq!(data_area2, 0x00FD);
        assert_eq!(target_id, 0x7F);
    }

    #[test]
    fn test_priv_cmd_param_write_f32() {
        // Write loc_kp = 30.0 to motor_id=1, master_id=0xFD
        let (ext_id, data) = priv_cmd_param_write_f32(0xFD, 0x01, 0x701E, 30.0);
        let (comm_type, _, target_id) = parse_ext_can_id(ext_id);
        assert_eq!(comm_type, 0x12);
        assert_eq!(target_id, 0x01);
        // index = 0x701E in LE = [0x1E, 0x70]
        assert_eq!(data[0], 0x1E);
        assert_eq!(data[1], 0x70);
        // value = 30.0f32 in LE = [0x00, 0x00, 0xF0, 0x41]
        let val = f32::from_le_bytes([data[4], data[5], data[6], data[7]]);
        assert!((val - 30.0).abs() < 0.001);
    }

    #[test]
    fn test_priv_cmd_param_read() {
        let (ext_id, data) = priv_cmd_param_read(0xFD, 0x7F, 0x701E);
        let (comm_type, data_area2, target_id) = parse_ext_can_id(ext_id);
        assert_eq!(comm_type, 0x11);
        assert_eq!(target_id, 0x7F);
        assert_eq!((data_area2 >> 8) & 0xFF, 0xFD); // master_id in high byte
        assert_eq!(data[0], 0x1E);
        assert_eq!(data[1], 0x70);
    }

    #[test]
    fn test_decode_param_read_response() {
        // Simulated response: loc_kp = 30.0, success
        let data_area2: u16 = 0x007F; // bit[23:16]=0x00 (success), motor_id in low byte
        let val_bytes = 30.0_f32.to_le_bytes();
        let data = [0x1E, 0x70, 0x00, 0x00, val_bytes[0], val_bytes[1], val_bytes[2], val_bytes[3]];
        let resp = decode_param_read_response(data_area2, &data);
        assert_eq!(resp.index, 0x701E);
        assert!(resp.success);
        assert!((resp.value_f32 - 30.0).abs() < 0.001);
    }

    #[test]
    fn test_position_cmd_le_bytes() {
        // PDF example: position=5rad, speed=5rad/s → 00 00 A0 40 00 00 A0 40
        let data = cmd_position(5.0, 5.0);
        assert_eq!(data, [0x00, 0x00, 0xA0, 0x40, 0x00, 0x00, 0xA0, 0x40]);
    }
}
