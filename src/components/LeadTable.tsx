import { useCRM } from '@/contexts/CRMContext';
import { Lead, LeadStatus, STATUS_LABELS, STATUS_COLORS, TEAM_LABELS } from '@/types/crm';
import { cn } from '@/lib/utils';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';

type SortKey = 'name' | 'company' | 'status' | 'updatedAt';

function sortLeads(leads: Lead[], sortBy: SortKey, sortDir: 'asc' | 'desc'): Lead[] {
  return [...leads].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    if (sortBy === 'name') {
      av = (a.name ?? '').toLowerCase();
      bv = (b.name ?? '').toLowerCase();
    } else if (sortBy === 'company') {
      av = (a.company ?? '').toLowerCase();
      bv = (b.company ?? '').toLowerCase();
    } else if (sortBy === 'status') {
      av = a.status ?? '';
      bv = b.status ?? '';
    } else {
      av = a.updatedAt ?? '';
      bv = b.updatedAt ?? '';
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

const statusDot: Record<LeadStatus, string> = {
  not_contacted: 'bg-muted-foreground',
  reached_out: 'bg-accent',
  responded: 'bg-primary',
  in_discussion: 'bg-primary',
  confirmed: 'bg-success',
  rejected: 'bg-destructive',
  inactive: 'bg-muted-foreground',
};

const priorityLabel: Record<string, string> = {
  high: 'H',
  medium: 'M',
  low: 'L',
};

const priorityColor: Record<string, string> = {
  high: 'text-destructive',
  medium: 'text-accent',
  low: 'text-muted-foreground',
};

export default function LeadTable() {
  const { filteredLeads, selectedLead, setSelectedLead, searchQuery, setSearchQuery, selectedTeam, isLoading } = useCRM();
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedLeads = useMemo(
    () => sortLeads(filteredLeads, sortBy, sortDir),
    [filteredLeads, sortBy, sortDir]
  );

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) return <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-3">
        <h2 className="text-sm font-semibold font-mono">
          {selectedTeam === 'all' ? 'ALL LEADS' : TEAM_LABELS[selectedTeam].toUpperCase()}
        </h2>
        <span className="text-xs text-muted-foreground font-mono">{filteredLeads.length}</span>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leads, companies, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted border-border"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-[10px] font-mono uppercase text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-medium">
                <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  Name <SortIcon column="name" />
                </button>
              </th>
              <th className="text-left px-4 py-2.5 font-medium">
                <button onClick={() => toggleSort('company')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  Company <SortIcon column="company" />
                </button>
              </th>
              <th className="text-left px-4 py-2.5 font-medium">
                <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  Status <SortIcon column="status" />
                </button>
              </th>
              <th className="text-left px-4 py-2.5 font-medium">Teams</th>
              <th className="text-left px-4 py-2.5 font-medium">Region</th>
              <th className="text-center px-4 py-2.5 font-medium">Pri</th>
              <th className="text-left px-4 py-2.5 font-medium">
                <button onClick={() => toggleSort('updatedAt')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  Updated <SortIcon column="updatedAt" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Loading leads…
                </td>
              </tr>
            ) : (
            sortedLeads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={cn(
                  'border-b border-border/50 cursor-pointer transition-colors text-xs',
                  selectedLead?.id === lead.id
                    ? 'bg-secondary/80'
                    : 'hover:bg-secondary/40'
                )}
              >
                <td className="px-4 py-2.5 font-medium">{lead.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{lead.company}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full', statusDot[lead.status])} />
                    <span className={cn('text-[11px]', STATUS_COLORS[lead.status])}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {lead.teams.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">
                        {TEAM_LABELS[t]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{lead.region}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={cn('font-mono font-bold text-[10px]', priorityColor[lead.priority])}>
                    {priorityLabel[lead.priority]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground font-mono text-[10px]">{lead.updatedAt?.slice(0, 10)}</td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
