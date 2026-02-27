import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import { HomePage } from "./pages/HomePage";
import { ImuDebugPage } from "./pages/imu-debug/ImuDebugPage";
import { MotorSelectPage } from "./pages/motor-debug/MotorSelectPage";
import { RS00DebugPage } from "./pages/motor-debug/rs00/RS00DebugPage";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="imu-debug" element={<ImuDebugPage />} />
          <Route path="motor-debug" element={<MotorSelectPage />} />
          <Route path="motor-debug/rs00" element={<RS00DebugPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
