"use client";

import { useCRM } from "@/contexts/CRMContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, CheckCircle, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { TEAM_LABELS, TeamType } from "@/types/crm";
import { cn } from "@/lib/utils";

type OutreachRow = {
  id: string;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  wrapper_type: string;
  created_at: string;
  entities: { id: string; name: string } | null;
  people: { id: string; name: string } | null;
};

const WRAPPER_TO_TEAM: Record<string, TeamType> = {
  sponsor_devrel: "devrel",
  speaker_media: "speaker",
  sponsorships: "sponsorship",
  ecosystem: "ecosystem",
};

export default function DailySummary() {
  const { leads } = useCRM();

  const { data: outreachList = [] } = useQuery({
    queryKey: ["outreach-summary"],
    queryFn: async () => {
      const res = await fetch("/api/outreach");
      if (!res.ok) return [];
      return res.json() as Promise<OutreachRow[]>;
    },
  });

  const totalContacted = outreachList.filter((o) => o.status === "sent" || o.status === "replied").length;
  const totalResponses = outreachList.filter((o) => o.status === "replied").length;
  const totalConfirmed = leads.filter((l) => l.status === "confirmed").length;
  const conversionRate =
    totalContacted > 0 ? Math.round((totalConfirmed / totalContacted) * 100) : 0;
  const recentOutreach = outreachList.slice(0, 10);

  const hotLeads = leads
    .filter((l) => l.priority === "high" || l.status === "in_discussion")
    .slice(0, 5)
    .map((l) => l.company);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-auto">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold font-mono">DAILY SUMMARY</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Pipeline stats and recent outreach from database
            </p>
          </div>
          <Button size="sm" className="h-7 text-[11px] font-mono" disabled>
            <Sparkles className="w-3 h-3 mr-1" />
            Generate Report
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <Card className="bg-card border-border">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-mono uppercase flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              This Week Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-5 gap-4">
              <div>
                <span className="text-[10px] font-mono text-muted-foreground block">Contacted</span>
                <span className="text-lg font-mono font-bold text-foreground">{totalContacted}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground block">Responses</span>
                <span className="text-lg font-mono font-bold text-primary">{totalResponses}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground block">Confirmed</span>
                <span className="text-lg font-mono font-bold text-success">{totalConfirmed}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground block">Conversion</span>
                <span className="text-lg font-mono font-bold text-accent">{conversionRate}%</span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground block">Hot Leads</span>
                <div className="flex flex-col gap-0.5 mt-1">
                  {hotLeads.length ? hotLeads.map((l) => (
                    <span key={l} className="text-[11px] text-foreground">{l}</span>
                  )) : <span className="text-[11px] text-muted-foreground">—</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-mono uppercase flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Recent Outreach
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {recentOutreach.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No outreach yet. Data from database.</p>
            ) : (
              recentOutreach.map((o) => (
                <div key={o.id} className="flex items-start gap-2 border-b border-border/50 pb-2 last:border-0">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 mt-0.5",
                      o.status === "replied" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"
                    )}
                  >
                    {TEAM_LABELS[WRAPPER_TO_TEAM[o.wrapper_type]] ?? o.wrapper_type}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11px] text-secondary-foreground">
                      {o.entities?.name ?? "—"} — {o.subject || o.body?.slice(0, 40) || o.channel}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">{o.created_at.slice(0, 10)} · {o.status}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
