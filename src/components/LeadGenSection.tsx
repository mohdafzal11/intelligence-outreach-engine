import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, Loader2, Radio, Globe, Handshake,
  DollarSign, Code, Users, ExternalLink, Sparkles, CheckCircle,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { TeamType, TEAM_LABELS } from '@/types/crm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCRM } from '@/contexts/CRMContext';

const ALL_TEAMS: TeamType[] = ['speaker', 'media', 'partnerships', 'sponsorship', 'devrel', 'ecosystem'];

const teamIcons: Record<TeamType, typeof Users> = {
  speaker: Radio,
  media: Globe,
  partnerships: Handshake,
  sponsorship: DollarSign,
  devrel: Code,
  ecosystem: Users,
};

const teamColors: Record<TeamType, string> = {
  speaker: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  media: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  partnerships: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  sponsorship: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  devrel: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  ecosystem: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
};

const TEAM_TO_WRAPPER: Record<TeamType, string> = {
  speaker: 'speaker_media',
  media: 'speaker_media',
  partnerships: 'ecosystem',
  sponsorship: 'sponsorships',
  devrel: 'sponsor_devrel',
  ecosystem: 'ecosystem',
};

interface GeneratedLead {
  name: string;
  description: string;
  team: TeamType;
  relevanceScore: number;
  website?: string;
  twitter?: string;
  reasoning: string;
}

interface LeadGenResponse {
  leads: GeneratedLead[];
  searchResultsCount: number;
  scrapedPagesCount: number;
}

const EXAMPLE_QUERIES = [
  'web3 gaming companies for sponsorship',
  'crypto podcast hosts and media outlets',
  'DeFi developer tools and SDK providers',
];

export default function LeadGenSection() {
  const { refetchLeads } = useCRM();
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ message: '', percent: 0 });
  const [results, setResults] = useState<LeadGenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterTeam, setFilterTeam] = useState<TeamType | 'all'>('all');
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [savingLeads, setSavingLeads] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const toggleLead = (index: number) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAllLeads = () => {
    if (!results) return;
    const visible = filteredLeads.map((_, i) => {
      // map back to original index
      return results.leads.indexOf(filteredLeads[i]);
    });
    const allSelected = visible.every((i) => selectedLeads.has(i));
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      visible.forEach((i) => (allSelected ? next.delete(i) : next.add(i)));
      return next;
    });
  };

  const handleSaveSelected = async () => {
    if (!results || selectedLeads.size === 0) return;
    setSavingLeads(true);
    let saved = 0;

    for (const idx of Array.from(selectedLeads)) {
      const lead = results.leads[idx];
      if (!lead) continue;
      try {
        // First create entity via research
        const researchRes = await fetch('/api/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: lead.name,
            website: lead.website || undefined,
            twitterHandle: lead.twitter || undefined,
          }),
        });
        const researchData = await researchRes.json();
        if (researchRes.ok) {
          // Add to pipeline with team's wrapper type
          const entityId = researchData?.id ?? researchData?.entity?.id;
          if (entityId) {
            await fetch('/api/pipeline', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entityId,
                wrapperType: TEAM_TO_WRAPPER[lead.team],
              }),
            });
          }
          saved++;
        }
      } catch {
        // continue with other leads
      }
    }

    setSavingLeads(false);
    if (saved > 0) {
      toast.success(`Saved ${saved} lead(s) to pipeline`);
      refetchLeads();
      setSelectedLeads(new Set());
    } else {
      toast.error('Failed to save leads');
    }
  };

  const handleGenerate = async () => {
    const trimmed = query.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setResults(null);
    setError(null);
    setFilterTeam('all');
    setSelectedLeads(new Set());
    setProgress({ message: 'Searching the web via SerpAPI...', percent: 15 });

    clearTimers();
    timersRef.current.push(
      setTimeout(() => setProgress({ message: 'Scraping top results with Firecrawl...', percent: 40 }), 3000),
      setTimeout(() => setProgress({ message: 'AI analyzing & generating leads...', percent: 70 }), 7000),
      setTimeout(() => setProgress({ message: 'Assigning teams & scoring...', percent: 90 }), 12000),
    );

    try {
      const res = await fetch('/api/leadgen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });

      clearTimers();
      const data = await res.json();

      if (!res.ok) {
        setError(data?.details ?? data?.error ?? 'Lead generation failed');
        toast.error(data?.details ?? data?.error ?? 'Lead generation failed');
        return;
      }

      setProgress({ message: 'Complete!', percent: 100 });
      setResults(data);
      toast.success(`Generated ${data.leads.length} leads from ${data.searchResultsCount} search results`);
    } catch (e) {
      clearTimers();
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
      setTimeout(() => setProgress({ message: '', percent: 0 }), 1500);
    }
  };

  const filteredLeads = results
    ? filterTeam === 'all'
      ? results.leads
      : results.leads.filter((l) => l.team === filterTeam)
    : [];

  const teamCounts = results
    ? results.leads.reduce<Record<string, number>>((acc, l) => {
        acc[l.team] = (acc[l.team] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-auto">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold font-mono">LEAD GENERATION</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Enter a prompt — AI searches the web, scrapes pages, and generates leads. Select leads to save to pipeline.
        </p>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Search Input */}
        <Card className="bg-card border-border border-primary/30 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Describe the leads you're looking for..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  className="pl-10 h-12 text-sm bg-muted border-border"
                  disabled={isGenerating}
                />
              </div>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !query.trim()}
                className="h-12 px-6"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Generate Leads
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuery(q)}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {isGenerating && (
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-primary">{progress.message}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{progress.percent}%</span>
              </div>
              <Progress value={progress.percent} className="h-1.5" />
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="bg-destructive/5 border-destructive/30">
            <CardContent className="p-4">
              <p className="text-xs text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results && (
          <>
            {/* Stats + Actions bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-[10px]">
                  {results.leads.length} leads generated
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {results.searchResultsCount} web results
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {results.scrapedPagesCount} pages scraped
                </Badge>
              </div>
              {selectedLeads.size > 0 && (
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleSaveSelected}
                  disabled={savingLeads}
                >
                  {savingLeads ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Save {selectedLeads.size} lead{selectedLeads.size > 1 ? 's' : ''} to pipeline
                </Button>
              )}
            </div>

            {/* Team Filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterTeam('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[10px] font-mono transition-colors border',
                  filterTeam === 'all'
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                )}
              >
                All ({results.leads.length})
              </button>
              {(Object.keys(TEAM_LABELS) as TeamType[]).map((team) => {
                const count = teamCounts[team] ?? 0;
                if (count === 0) return null;
                const Icon = teamIcons[team];
                return (
                  <button
                    key={team}
                    onClick={() => setFilterTeam(team)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono transition-colors border',
                      filterTeam === team
                        ? teamColors[team]
                        : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {TEAM_LABELS[team]} ({count})
                  </button>
                );
              })}
            </div>

            {/* Select all row */}
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                checked={filteredLeads.length > 0 && filteredLeads.every((_, i) => selectedLeads.has(results.leads.indexOf(filteredLeads[i])))}
                onCheckedChange={toggleAllLeads}
                className="w-4 h-4"
              />
              <span className="text-[10px] font-mono text-muted-foreground">
                Select all ({filteredLeads.length})
              </span>
            </div>

            {/* Lead Cards with checkboxes */}
            <div className="space-y-3">
              {filteredLeads.map((lead, i) => {
                const originalIndex = results.leads.indexOf(lead);
                const isSelected = selectedLeads.has(originalIndex);
                const Icon = teamIcons[lead.team];
                return (
                  <Card
                    key={originalIndex}
                    className={cn(
                      'bg-card border-border transition-colors cursor-pointer',
                      isSelected && 'border-primary/40 bg-primary/5'
                    )}
                    onClick={() => toggleLead(originalIndex)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleLead(originalIndex)}
                          className="w-4 h-4 mt-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="text-sm font-semibold">{lead.name}</h4>
                            <span className={cn(
                              'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border',
                              teamColors[lead.team]
                            )}>
                              <Icon className="w-3 h-3" />
                              {TEAM_LABELS[lead.team]}
                            </span>
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
                              lead.relevanceScore >= 70
                                ? 'bg-success/10 text-success'
                                : lead.relevanceScore >= 40
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                            )}>
                              {lead.relevanceScore}
                            </span>
                          </div>
                          <p className="text-[11px] text-secondary-foreground leading-relaxed mb-1">
                            {lead.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground italic">
                            {lead.reasoning}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            {lead.website && (
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Globe className="w-3 h-3" />
                                Website
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                            {lead.twitter && (
                              <a
                                href={`https://twitter.com/${lead.twitter.replace('@', '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                @{lead.twitter.replace('@', '')}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredLeads.length === 0 && (
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <p className="text-[11px] text-muted-foreground italic">
                      No leads for this team filter.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
