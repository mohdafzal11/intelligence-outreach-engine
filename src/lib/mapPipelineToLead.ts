import type { Lead, LeadStatus, TeamType } from "@/types/crm";

type PipelineRow = {
  id: string;
  entity_id: string;
  wrapper_type: string;
  stage: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  entities: {
    id: string;
    name: string;
    fit_score: number | null;
    website: string | null;
    twitter_handle: string | null;
    overview: string | null;
    category: string[] | null;
  } | null;
};

const STAGE_TO_STATUS: Record<string, LeadStatus> = {
  lead: "not_contacted",
  contacted: "reached_out",
  in_discussion: "in_discussion",
  proposal_sent: "responded",
  confirmed: "confirmed",
  lost: "rejected",
};

/** Map UI status to pipeline stage for PUT /api/pipeline/[id] */
export const STATUS_TO_STAGE: Record<LeadStatus, string> = {
  not_contacted: "lead",
  reached_out: "contacted",
  responded: "proposal_sent",
  in_discussion: "in_discussion",
  confirmed: "confirmed",
  rejected: "lost",
  inactive: "lost",
};

const WRAPPER_TO_TEAMS: Record<string, TeamType[]> = {
  sponsor_devrel: ["devrel"],
  speaker_media: ["speaker", "media"],
  sponsorships: ["sponsorship"],
  ecosystem: ["ecosystem"],
};

/** Map team (single) to pipeline wrapper_type for PUT /api/pipeline/[id] */
export const TEAM_TO_WRAPPER: Record<TeamType, string> = {
  devrel: "sponsor_devrel",
  speaker: "speaker_media",
  media: "speaker_media",
  partnerships: "ecosystem",
  sponsorship: "sponsorships",
  ecosystem: "ecosystem",
};

export function mapPipelineRowToLead(row: PipelineRow): Lead {
  const entity = row.entities;
  const name = entity?.name ?? "Unknown";
  const fitScore = entity?.fit_score ?? 50;
  const priority: "high" | "medium" | "low" =
    fitScore >= 70 ? "high" : fitScore >= 40 ? "medium" : "low";
  const teams: TeamType[] =
    WRAPPER_TO_TEAMS[row.wrapper_type] ?? ["ecosystem"];
  const status: LeadStatus =
    STAGE_TO_STATUS[row.stage] ?? "not_contacted";

  const notes =
    row.notes?.trim() ?
      [
        {
          id: `note-${row.id}`,
          date: row.updated_at.slice(0, 10),
          type: "note" as const,
          content: row.notes,
          author: "Pipeline",
        },
      ]
    : [];

  return {
    id: row.id,
    entityId: entity?.id ?? row.entity_id,
    wrapperType: row.wrapper_type,
    name,
    role: "",
    company: name,
    relevance: entity?.overview?.slice(0, 300) ?? "",
    topics: entity?.category ?? [],
    region: "",
    twitter: entity?.twitter_handle
      ? (entity.twitter_handle.startsWith("@")
          ? entity.twitter_handle
          : `@${entity.twitter_handle}`)
      : undefined,
    teams,
    status,
    priority,
    notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
