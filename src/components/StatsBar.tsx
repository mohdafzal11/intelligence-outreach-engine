import { useCRM } from '@/contexts/CRMContext';
import { LeadStatus, STATUS_LABELS, STATUS_COLORS } from '@/types/crm';
import { cn } from '@/lib/utils';
import { Users, UserCheck, Clock, MessageSquare, CheckCircle, XCircle, Pause, TrendingUp } from 'lucide-react';

const statusIcons: Record<LeadStatus, typeof Users> = {
  not_contacted: Clock,
  reached_out: MessageSquare,
  responded: MessageSquare,
  in_discussion: TrendingUp,
  confirmed: CheckCircle,
  rejected: XCircle,
  inactive: Pause,
};

export default function StatsBar() {
  const { leads, filteredLeads, selectedTeam } = useCRM();

  const statusCounts: Record<LeadStatus, number> = {
    not_contacted: 0,
    reached_out: 0,
    responded: 0,
    in_discussion: 0,
    confirmed: 0,
    rejected: 0,
    inactive: 0,
  };

  filteredLeads.forEach((lead) => {
    statusCounts[lead.status]++;
  });

  const displayStatuses: LeadStatus[] = ['confirmed', 'in_discussion', 'responded', 'reached_out', 'not_contacted'];

  return (
    <div className="border-b border-border px-4 py-3 flex items-center gap-4">
      {displayStatuses.map((status) => {
        const Icon = statusIcons[status];
        return (
          <div key={status} className="flex items-center gap-1.5">
            <Icon className={cn('w-3 h-3', STATUS_COLORS[status])} />
            <span className="text-[10px] text-muted-foreground font-mono">{STATUS_LABELS[status]}</span>
            <span className={cn('text-xs font-mono font-bold', STATUS_COLORS[status])}>
              {statusCounts[status]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
