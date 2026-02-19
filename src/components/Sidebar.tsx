import { Users, Radio, Handshake, DollarSign, Code, Globe, LayoutDashboard, Search, BookOpen, UserPlus, Send, FileText, Database } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { TeamType, TEAM_LABELS } from '@/types/crm';
import { ViewType } from '@/contexts/CRMContext';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

const teamIcons: Record<TeamType, typeof Users> = {
  speaker: Radio,
  media: Globe,
  partnerships: Handshake,
  sponsorship: DollarSign,
  devrel: Code,
  ecosystem: Users,
};

const viewItems: { key: ViewType; label: string; icon: typeof Users }[] = [
  { key: 'research', label: 'Research', icon: BookOpen },
  { key: 'leadgen', label: 'Lead Gen', icon: UserPlus },
  { key: 'outreach', label: 'Outreach', icon: Send },
  { key: 'summary', label: 'Daily Summary', icon: FileText },
];

export default function Sidebar() {
  const { selectedTeam, setSelectedTeam, leads, activeView, setActiveView } = useCRM();

  const { data: dbTest, isLoading: dbLoading } = useQuery({
    queryKey: ['db-test'],
    queryFn: async () => {
      const res = await fetch('/api/db-test');
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const teams: (TeamType | 'all')[] = ['all', 'speaker', 'media', 'partnerships', 'sponsorship', 'devrel', 'ecosystem'];

  const getCount = (team: TeamType | 'all') => {
    if (team === 'all') return leads.length;
    return leads.filter((l) => l.teams.includes(team)).length;
  };

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col h-screen">
      <div className="p-4 border-b border-border">
        <h1 className="text-sm font-bold font-mono tracking-wider text-gradient">NEXUS</h1>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Intelligence & Outreach</p>
      </div>

      {/* Views */}
      <nav className="p-2 space-y-0.5 border-b border-border">
        <span className="text-[9px] font-mono uppercase text-muted-foreground px-3 py-1 block">Views</span>
        {viewItems.map(({ key, label, icon: Icon }) => {
          const isActive = activeView === key;
          return (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
                isActive
                  ? 'bg-secondary text-foreground glow-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Teams Filter */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-auto">
        <span className="text-[9px] font-mono uppercase text-muted-foreground px-3 py-1 block">Teams</span>
        {teams.map((team) => {
          const isActive = selectedTeam === team;
          const Icon = team === 'all' ? LayoutDashboard : teamIcons[team];
          const label = team === 'all' ? 'All Teams' : TEAM_LABELS[team];

          return (
            <button
              key={team}
              onClick={() => setSelectedTeam(team)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
                isActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">{label}</span>
              <span className={cn(
                'font-mono text-[10px]',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {getCount(team)}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
