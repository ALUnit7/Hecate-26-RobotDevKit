import "./App.css";
import { Outlet } from "react-router-dom";
import { AppNavbar } from "./components/layout/AppNavbar";

function App() {
  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <AppNavbar />
      <Outlet />
    </div>
  );
}

export default App;
