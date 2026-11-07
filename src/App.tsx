import "./App.css";
import { Outlet } from "react-router-dom";
import { AppNavbar } from "./components/layout/AppNavbar";
import { PlaybackBar } from "./components/layout/PlaybackBar";
import { usePlayback } from "./hooks/use-playback";

function App() {
  // Mount playback engine once at app root — drives RAF loop when replaying
  usePlayback();

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <AppNavbar />
      <PlaybackBar />
      <Outlet />
    </div>
  );
}

export default App;
