import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import Intake from "@/pages/Intake";
import Assessment from "@/pages/Assessment";
import Report from "@/pages/Report";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/assessment/:sessionId" element={<Intake />} />
        <Route path="/assessment/:sessionId/evidence" element={<Assessment />} />
        <Route path="/report/:sessionId" element={<Report />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
