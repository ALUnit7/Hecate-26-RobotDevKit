import { useImuData } from "../../hooks/use-imu-data";
import { ConnectionToolbar } from "../../components/toolbar/ConnectionToolbar";
import { DataDashboard } from "../../components/dashboard/DataDashboard";
import { RealtimeChart } from "../../components/charts/RealtimeChart";
import { AttitudeViewer } from "../../components/viewer3d/AttitudeViewer";
import { CommandConsole } from "../../components/console/CommandConsole";

export function ImuDebugPage() {
  useImuData();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* IMU toolbar */}
      <ConnectionToolbar />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Charts (60%) */}
        <div className="w-[60%] border-r border-zinc-800">
          <RealtimeChart />
        </div>

        {/* Right: 3D Viewer (40%) */}
        <div className="w-[40%]">
          <AttitudeViewer />
        </div>
      </div>

      {/* Data dashboard */}
      <DataDashboard />

      {/* Command console (fixed height) */}
      <div className="h-[180px] min-h-[120px]">
        <CommandConsole />
      </div>
    </div>
  );
}
