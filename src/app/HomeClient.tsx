"use client";

import Sidebar from "@/components/Sidebar";
import LeadTable from "@/components/LeadTable";
import LeadDetail from "@/components/LeadDetail";
import StatsBar from "@/components/StatsBar";
import ResearchSection from "@/components/ResearchSection";
import LeadGenSection from "@/components/LeadGenSection";
import OutreachSection from "@/components/OutreachSection";
import DailySummary from "@/components/DailySummary";
import { CRMProvider, useCRM } from "@/contexts/CRMContext";

function MainContent() {
  const { activeView } = useCRM();

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {activeView === "pipeline" && (
        <>
          <StatsBar />
          <div className="flex-1 flex min-h-0">
            <LeadTable />
            <LeadDetail />
          </div>
        </>
      )}
      {activeView === "research" && <ResearchSection />}
      {activeView === "leadgen" && <LeadGenSection />}
      {activeView === "outreach" && <OutreachSection />}
      {activeView === "summary" && <DailySummary />}
    </div>
  );
}

export function HomeClient() {
  return (
    <CRMProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <MainContent />
      </div>
    </CRMProvider>
  );
}
