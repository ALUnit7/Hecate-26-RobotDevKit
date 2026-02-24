export interface ImuData {
  acc: [number, number, number];
  gyr: [number, number, number];
  mag: [number, number, number];
  roll: number;
  pitch: number;
  yaw: number;
  quat: [number, number, number, number];
  temperature: number;
  air_pressure: number;
  system_time: number;
}

export interface PortInfo {
  name: string;
  port_type: string;
}
