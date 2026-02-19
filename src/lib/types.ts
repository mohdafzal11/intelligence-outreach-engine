export type WrapperType =
  | "sponsor_devrel"
  | "speaker_media"
  | "sponsorships"
  | "ecosystem";

export type OutreachChannel = "email" | "linkedin_dm" | "linkedin" | "telegram" | "twitter" | "whatsapp";

export type OutreachStatus =
  | "draft"
  | "sent"
  | "replied"
  | "follow_up_needed"
  | "closed";

export type PipelineStage =
  | "lead"
  | "contacted"
  | "in_discussion"
  | "proposal_sent"
  | "confirmed"
  | "lost";

export interface Entity {
  id: string;
  name: string;
  website: string | null;
  twitter_handle: string | null;
  category: string[];
  description: string | null;
  overview: string | null;
  fit_score: number | null;
  fit_score_breakdown: Record<string, number> | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  entity_id: string;
  name: string;
  role: string | null;
  email: string | null;
  twitter_handle: string | null;
  linkedin_url: string | null;
  created_at: string;
}

export interface Outreach {
  id: string;
  entity_id: string;
  person_id: string | null;
  wrapper_type: WrapperType;
  channel: OutreachChannel;
  subject: string | null;
  body: string;
  status: OutreachStatus;
  sent_by: string | null;
  created_at: string;
}

export interface Pipeline {
  id: string;
  entity_id: string;
  wrapper_type: WrapperType;
  stage: PipelineStage;
  owner: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityWithRelations extends Entity {
  people?: Person[];
  outreach?: Outreach[];
  pipeline?: Pipeline[];
}

export interface FitScoreBreakdown {
  category_alignment?: number;
  budget_signals?: number;
  ecosystem_activity?: number;
  sponsorship_history?: number;
}

export interface SuggestedContact {
  name: string;
  likely_role: string;
  reasoning: string;
}

export interface AIInsights {
  overview: string;
  category: string[];
  fit_score: number;
  fit_breakdown: FitScoreBreakdown;
  suggested_contacts: SuggestedContact[];
  key_hooks: string[];
}
