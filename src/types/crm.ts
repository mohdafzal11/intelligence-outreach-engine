export type TeamType = 'speaker' | 'media' | 'partnerships' | 'sponsorship' | 'devrel' | 'ecosystem';

export type LeadStatus = 'not_contacted' | 'reached_out' | 'responded' | 'in_discussion' | 'confirmed' | 'rejected' | 'inactive';

export interface Lead {
  id: string;
  /** Entity id from backend (for fetching detail) */
  entityId?: string;
  /** Pipeline wrapper_type (for saving outreach) */
  wrapperType?: string;
  name: string;
  role: string;
  company: string;
  relevance: string;
  topics: string[];
  region: string;
  email?: string;
  linkedin?: string;
  twitter?: string;
  telegram?: string;
  teams: TeamType[];
  status: LeadStatus;
  priority: 'high' | 'medium' | 'low';
  notes: OutreachNote[];
  createdAt: string;
  updatedAt: string;
}

export interface OutreachNote {
  id: string;
  date: string;
  type: 'research' | 'outreach' | 'response' | 'note';
  channel?: 'email' | 'linkedin' | 'telegram' | 'twitter' | 'whatsapp';
  content: string;
  author: string;
}

export const TEAM_LABELS: Record<TeamType, string> = {
  speaker: 'Speaker',
  media: 'Media',
  partnerships: 'Partnerships',
  sponsorship: 'Sponsorship',
  devrel: 'DevRel',
  ecosystem: 'Ecosystem',
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  not_contacted: 'Not Contacted',
  reached_out: 'Reached Out',
  responded: 'Responded',
  in_discussion: 'In Discussion',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  inactive: 'Inactive',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  not_contacted: 'text-muted-foreground',
  reached_out: 'text-accent',
  responded: 'text-primary',
  in_discussion: 'text-primary',
  confirmed: 'text-success',
  rejected: 'text-destructive',
  inactive: 'text-muted-foreground',
};
