import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { useImuStore } from "../../stores/imu-store";

// Rotation that converts ROS coordinate system (X-forward, Y-left, Z-up)
// to Three.js coordinate system (X-right, Y-up, Z-out-of-screen).
// This is a -90° rotation around the X axis.
const ROS_TO_THREE = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2
);

function ImuBox() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const latest = useImuStore((s) => s.latest);

  useFrame(() => {
    if (!meshRef.current || !latest) return;
    // IMU quaternion in ROS frame (w, x, y, z)
    const [w, x, y, z] = latest.quat;
    const imuQuat = new THREE.Quaternion(x, y, z, w);
    // Convert: first apply ROS-to-Three basis change, then the IMU rotation
    meshRef.current.quaternion.copy(ROS_TO_THREE).multiply(imuQuat);
  });

  // Geometry is in the mesh's local frame. ROS_TO_THREE (-90° around X) maps:
  //   local X → world X,  local Y → world -Z,  local Z → world Y (visual up)
  // So to get a flat board (large XY footprint, thin Z in ROS), we need:
  //   local X = wide (ROS X), local Y = wide (ROS Y), local Z = thin (ROS Z / visual height)
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2.4, 1.6, 0.4]} />
      <meshStandardMaterial color="#3b82f6" opacity={0.9} transparent />
      {/* Top face accent (local Z+ face = visual top after transform) */}
      <mesh position={[0, 0, 0.21]}>
        <boxGeometry args={[2.2, 1.4, 0.02]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      {/* Forward direction arrow (X+) pointing along local X */}
      <mesh position={[1.0, 0, 0.25]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.15, 0.4, 4]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </mesh>
  );
}

function AxisHelper() {
  // Draw axes in ROS convention but rendered in Three.js space via ROS_TO_THREE.
  // Since the grid and axes are static reference, we apply the same basis transform
  // so that Z visually points up.
  return (
    <group quaternion={ROS_TO_THREE}>
      {/* ROS X axis (forward) - Red */}
      <mesh position={[1.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 3, 8]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      <Text position={[3.2, 0, 0]} fontSize={0.3} color="#ef4444">
        X
      </Text>

      {/* ROS Y axis (left) - Green */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 3, 8]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
      <Text position={[0, 3.2, 0]} fontSize={0.3} color="#22c55e">
        Y
      </Text>

      {/* ROS Z axis (up) - Blue */}
      <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 3, 8]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      <Text position={[0, 0, 3.2]} fontSize={0.3} color="#3b82f6">
        Z
      </Text>
    </group>
  );
}

export function AttitudeViewer() {
  const latest = useImuStore((s) => s.latest);

  return (
    <div className="h-full w-full relative">
      <Canvas
        camera={{ position: [4, 3, 4], fov: 45, up: [0, 1, 0] }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-3, -3, -3]} intensity={0.3} />
        <ImuBox />
        <AxisHelper />
        {/* Grid lies on XY plane in ROS space (the "ground"), which after
            ROS_TO_THREE becomes the XZ plane in Three.js — exactly where
            gridHelper draws by default. */}
        <gridHelper args={[8, 8, "#333333", "#222222"]} />
        <OrbitControls enablePan={false} />
      </Canvas>
      {/* Euler overlay */}
      {latest && (
        <div className="absolute bottom-2 left-2 text-xs font-mono text-zinc-400 bg-zinc-900/80 rounded px-2 py-1">
          R:{latest.roll.toFixed(1)}° P:{latest.pitch.toFixed(1)}° Y:
          {latest.yaw.toFixed(1)}°
        </div>
      )}
    </div>
  );
}
