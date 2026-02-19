"use client";

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lead, TeamType } from "@/types/crm";
import { mapPipelineRowToLead } from "@/lib/mapPipelineToLead";

/** Keep one pipeline row per entity (latest by updated_at) so each company shows once. */
function dedupePipelineByEntity<T extends { entity_id: string; updated_at?: string }>(rows: T[]): T[] {
  const byEntity = new Map<string, T>();
  for (const row of rows) {
    const eid = row.entity_id;
    const existing = byEntity.get(eid);
    if (!existing || (row.updated_at || "") > (existing.updated_at || ""))
      byEntity.set(eid, row);
  }
  return Array.from(byEntity.values());
}

export type ViewType = "pipeline" | "research" | "leadgen" | "outreach" | "summary";

interface CRMContextType {
  leads: Lead[];
  selectedTeam: TeamType | "all";
  setSelectedTeam: (team: TeamType | "all") => void;
  selectedLead: Lead | null;
  setSelectedLead: (lead: Lead | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredLeads: Lead[];
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  isLoading: boolean;
  refetchLeads: () => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<TeamType | "all">("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ViewType>("pipeline");

  const {
    data: pipelineRows = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["pipeline-leads"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline");
      if (!res.ok) throw new Error("Failed to fetch pipeline");
      const data = await res.json();
      return data;
    },
  });

  const refetchLeads = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] });
    refetch();
  }, [queryClient, refetch]);

  const dedupedRows = useMemo(
    () => (Array.isArray(pipelineRows) ? dedupePipelineByEntity(pipelineRows) : []),
    [pipelineRows]
  );

  const leads: Lead[] = dedupedRows.map((row: unknown) =>
    mapPipelineRowToLead(row as Parameters<typeof mapPipelineRowToLead>[0])
  );

  const filteredLeads = leads.filter((lead) => {
    const matchesTeam =
      selectedTeam === "all" || lead.teams.includes(selectedTeam);
    const matchesSearch =
      searchQuery === "" ||
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.topics.some((t) =>
        t.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesTeam && matchesSearch;
  });

  return (
    <CRMContext.Provider
      value={{
        leads,
        selectedTeam,
        setSelectedTeam,
        selectedLead,
        setSelectedLead,
        searchQuery,
        setSearchQuery,
        filteredLeads,
        activeView,
        setActiveView,
        isLoading,
        refetchLeads,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (!context) throw new Error("useCRM must be used within CRMProvider");
  return context;
}
