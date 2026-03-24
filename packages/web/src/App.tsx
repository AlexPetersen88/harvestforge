import { Routes, Route, Navigate } from "react-router-dom";

// Page imports — these will be built out
import CommandCenter from "@/pages/CommandCenter";
import MorningBriefing from "@/pages/MorningBriefing";
import RulesEngine from "@/pages/RulesEngine";
import WhatIfSimulator from "@/pages/WhatIfSimulator";
import CampaignPlanner from "@/pages/CampaignPlanner";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Layout from "@/components/Layout";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/command-center" replace />} />
        <Route path="/command-center" element={<CommandCenter />} />
        <Route path="/briefing" element={<MorningBriefing />} />
        <Route path="/rules" element={<RulesEngine />} />
        <Route path="/simulator" element={<WhatIfSimulator />} />
        <Route path="/campaigns" element={<CampaignPlanner />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
