"use client";

import { useCRM } from "@/contexts/CRMContext";
import { STATUS_LABELS, STATUS_COLORS, TEAM_LABELS } from "@/types/crm";
import type { LeadStatus, TeamType } from "@/types/crm";
import { STATUS_TO_STAGE, TEAM_TO_WRAPPER } from "@/lib/mapPipelineToLead";
import { cn } from "@/lib/utils";
import { X, Mail, Linkedin, Twitter, Send, MessageCircle, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  linkedin_dm: Linkedin,
  linkedin: Linkedin,
  twitter: Twitter,
  telegram: Send,
  whatsapp: MessageCircle,
};

const noteTypeStyles: Record<string, string> = {
  research: "border-l-primary",
  outreach: "border-l-accent",
  response: "border-l-success",
  note: "border-l-muted-foreground",
};

type EntityDetail = {
  id: string;
  name: string;
  overview: string | null;
  people?: { id: string; name: string; role: string | null; email: string | null; twitter_handle: string | null; linkedin_url: string | null }[];
  outreach?: { id: string; channel: string; subject: string | null; body: string; status: string; created_at: string }[];
};

export default function LeadDetail() {
  const { selectedLead, setSelectedLead, refetchLeads } = useCRM();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingTeam, setUpdatingTeam] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  const teamOptions: TeamType[] = ["speaker", "media", "partnerships", "sponsorship", "devrel", "ecosystem"];
  const currentTeam: TeamType = selectedLead?.teams?.[0] ?? "ecosystem";
  const priorityOptions = ["high", "medium", "low"] as const;
  const PRIORITY_TO_SCORE = { high: 80, medium: 50, low: 20 };

  const { data: entityDetail } = useQuery({
    queryKey: ["entity", selectedLead?.entityId],
    queryFn: async () => {
      if (!selectedLead?.entityId) return null;
      const res = await fetch(`/api/entities/${selectedLead.entityId}`);
      if (!res.ok) return null;
      return res.json() as Promise<EntityDetail>;
    },
    enabled: !!selectedLead?.entityId,
  });

  if (!selectedLead) return null;

  const primaryPerson = entityDetail?.people?.[0];
  const displayName = primaryPerson?.name ?? selectedLead.company;
  const displayRole = primaryPerson?.role ?? "";

  const notesFromOutreach =
    entityDetail?.outreach?.map((o) => ({
      id: o.id,
      date: o.created_at.slice(0, 10),
      type: "outreach" as const,
      channel: (o.channel === "linkedin_dm" ? "linkedin" : o.channel) as "email" | "linkedin" | "telegram" | "twitter" | "whatsapp",
      content: o.subject || o.body?.slice(0, 150) || "",
      author: "Outreach",
    })) ?? [];
  const timelineNotes = [...(selectedLead.notes ?? []), ...notesFromOutreach].sort(
    (a, b) => (b.date > a.date ? 1 : -1)
  );

  return (
    <div className="w-96 shrink-0 border-l border-border bg-card flex flex-col h-screen animate-slide-in">
      <div className="p-4 border-b border-border flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-sm">{displayName}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {displayRole ? `${displayRole} · ` : ""}{selectedLead.company}
          </p>
        </div>
        <button
          onClick={() => setSelectedLead(null)}
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 border-b border-border space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <RefreshCw className={cn("w-3.5 h-3.5 text-primary", updatingStatus && "animate-spin")} />
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Update status</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Changes save to database.</p>
            <Select
              value={selectedLead.status}
              disabled={updatingStatus}
              onValueChange={async (newStatus) => {
                if (newStatus === selectedLead.status) return;
                setUpdatingStatus(true);
                try {
                  const res = await fetch(`/api/pipeline/${selectedLead.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ stage: STATUS_TO_STAGE[newStatus as LeadStatus] }),
                  });
                  if (!res.ok) {
                    const d = await res.json();
                    toast.error(d?.error || "Update failed");
                    return;
                  }
                  toast.success("Status updated");
                  refetchLeads();
                  setSelectedLead({ ...selectedLead, status: newStatus as LeadStatus });
                } catch {
                  toast.error("Update failed");
                } finally {
                  setUpdatingStatus(false);
                }
              }}
            >
              <SelectTrigger
                className={cn(
                  "h-9 w-full text-xs font-medium",
                  STATUS_COLORS[selectedLead.status]
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Team</span>
            <Select
              value={currentTeam}
              disabled={updatingTeam}
              onValueChange={async (team: TeamType) => {
                if (team === currentTeam) return;
                setUpdatingTeam(true);
                try {
                  const res = await fetch(`/api/pipeline/${selectedLead.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ wrapper_type: TEAM_TO_WRAPPER[team] }),
                  });
                  if (!res.ok) {
                    const d = await res.json();
                    toast.error(d?.error || "Update failed");
                    return;
                  }
                  toast.success("Team updated");
                  refetchLeads();
                  setSelectedLead({ ...selectedLead, teams: [team] });
                } catch {
                  toast.error("Update failed");
                } finally {
                  setUpdatingTeam(false);
                }
              }}
            >
              <SelectTrigger className="h-9 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teamOptions.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {TEAM_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Priority</span>
            <Select
              value={selectedLead.priority}
              disabled={updatingPriority}
              onValueChange={async (priority: "high" | "medium" | "low") => {
                if (priority === selectedLead.priority || !selectedLead.entityId) return;
                setUpdatingPriority(true);
                try {
                  const res = await fetch(`/api/entities/${selectedLead.entityId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fit_score: PRIORITY_TO_SCORE[priority] }),
                  });
                  if (!res.ok) {
                    const d = await res.json();
                    toast.error(d?.error || "Update failed");
                    return;
                  }
                  toast.success("Priority updated");
                  refetchLeads();
                  setSelectedLead({ ...selectedLead, priority });
                } catch {
                  toast.error("Update failed");
                } finally {
                  setUpdatingPriority(false);
                }
              }}
            >
              <SelectTrigger
                className={cn(
                  "h-9 w-full text-xs font-medium",
                  selectedLead.priority === "high" ? "text-destructive" : selectedLead.priority === "medium" ? "text-accent" : "text-muted-foreground"
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-4 border-b border-border">
          <h4 className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Relevance</h4>
          <p className="text-xs text-secondary-foreground leading-relaxed">
            {entityDetail?.overview || selectedLead.relevance || "—"}
          </p>
        </div>

        <div className="p-4 border-b border-border">
          <h4 className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Topics</h4>
          <div className="flex flex-wrap gap-1.5">
            {(selectedLead.topics?.length ? selectedLead.topics : ["—"]).map((topic) => (
              <span key={topic} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                {topic}
              </span>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-border">
          <h4 className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Contact</h4>
          <div className="space-y-1.5">
            {primaryPerson?.email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="w-3 h-3" />
                <span>{primaryPerson.email}</span>
              </div>
            )}
            {(selectedLead.twitter || primaryPerson?.twitter_handle) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Twitter className="w-3 h-3" />
                <span>{selectedLead.twitter || primaryPerson?.twitter_handle}</span>
              </div>
            )}
            {primaryPerson?.linkedin_url && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Linkedin className="w-3 h-3" />
                <a href={primaryPerson.linkedin_url} target="_blank" rel="noreferrer" className="text-primary underline">
                  LinkedIn
                </a>
              </div>
            )}
            {!primaryPerson?.email && !selectedLead.twitter && !primaryPerson?.linkedin_url && (
              <p className="text-xs text-muted-foreground italic">No contact info</p>
            )}
          </div>
        </div>

        <div className="p-4">
          <h4 className="text-[10px] font-mono uppercase text-muted-foreground mb-3">Timeline</h4>
          <div className="space-y-2.5">
            {timelineNotes.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No activity yet</p>
            )}
            {timelineNotes.map((note) => {
              const ChannelIcon = note.channel ? channelIcons[note.channel] : null;
              return (
                <div key={note.id} className={cn("border-l-2 pl-3 py-1.5", noteTypeStyles[note.type] ?? "border-l-muted-foreground")}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground">{note.date}</span>
                    {ChannelIcon && <ChannelIcon className="w-2.5 h-2.5 text-muted-foreground" />}
                    <span className="text-[10px] text-muted-foreground capitalize">{note.type}</span>
                  </div>
                  <p className="text-xs text-secondary-foreground leading-relaxed">{note.content}</p>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">{note.author}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
