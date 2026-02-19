import { useCRM } from '@/contexts/CRMContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, Bookmark, Calendar, UserPlus, AtSign } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function ResearchSection() {
  const { selectedTeam, refetchLeads, setActiveView } = useCRM();
  const queryClient = useQueryClient();
  const [researchQuery, setResearchQuery] = useState('');
  const [lumaCompany, setLumaCompany] = useState('');
  const [lumaLoading, setLumaLoading] = useState(false);
  const [lumaDisplayEvents, setLumaDisplayEvents] = useState<{ id: string; title: string; url: string; event_date: string | null }[]>([]);

  const [newName, setNewName] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newTwitter, setNewTwitter] = useState('');
  const [researchLoading, setResearchLoading] = useState(false);

  const [twitterHandlesInput, setTwitterHandlesInput] = useState('');
  const [twitterFetchLoading, setTwitterFetchLoading] = useState(false);

  const searchTrimmed = researchQuery.trim();
  const { data: entities = [], isLoading: entitiesLoading } = useQuery({
    queryKey: ['entities-research', searchTrimmed],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTrimmed) params.set('search', searchTrimmed);
      const res = await fetch(`/api/entities?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: savedLumaEvents = [], refetch: refetchSavedLuma } = useQuery({
    queryKey: ['luma-saved', searchTrimmed],
    queryFn: async () => {
      if (!searchTrimmed) return [];
      const res = await fetch(`/api/luma/events/saved?company=${encodeURIComponent(searchTrimmed)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!searchTrimmed,
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-auto">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold font-mono">RESEARCH HUB</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Add new leads below · Search companies · Market signals & trend analysis</p>
          </div>
          <div className="space-y-1">
            <div className="relative w-80">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search companies (e.g. Eigen Layer, Polygon)..."
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-muted border-border"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Filters the list below. Add new companies with the form below.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Add new lead — first and prominent */}
        <Card className="bg-card border-border border-primary/30 shadow-sm" id="add-new-lead">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              <CardTitle className="text-xs font-semibold font-mono">Add new lead</CardTitle>
              <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">Saves to DB</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Research a company and add to pipeline. Data is stored in Supabase (entities + pipeline).</p>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <label className="text-[10px] font-mono text-muted-foreground">Company name *</label>
                <Input placeholder="e.g. EigenLayer" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-[10px] font-mono text-muted-foreground">Website (optional)</label>
                <Input placeholder="https://eigenlayer.xyz" value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-[10px] font-mono text-muted-foreground">Twitter (optional)</label>
                <Input placeholder="@eigenlayer" value={newTwitter} onChange={(e) => setNewTwitter(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <Button
              size="sm"
              className="h-8"
              disabled={researchLoading || !newName.trim()}
              onClick={async () => {
                setResearchLoading(true);
                try {
                  const res = await fetch('/api/research', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: newName.trim(),
                      website: newWebsite.trim() || undefined,
                      twitterHandle: newTwitter.trim() || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    toast.error(data?.error || 'Failed');
                    if (data?.details) toast.error(data.details);
                    return;
                  }
                  if (data?.existing) {
                    toast.success('Company already in DB — showing existing.');
                  } else if (data?.addedWithoutResearch) {
                    toast.success(data?.message ?? 'Company saved to DB. Add ANTHROPIC_API_KEY for AI insights.');
                  } else {
                    toast.success('Company added to DB and pipeline.');
                  }
                  setNewName('');
                  setNewWebsite('');
                  setNewTwitter('');
                  refetchLeads();
                  queryClient.invalidateQueries({ queryKey: ['entities-research'] });
                  queryClient.invalidateQueries({ queryKey: ['entities-leadgen'] });
                  setActiveView('pipeline');
                } catch (e) {
                  toast.error('Something went wrong');
                } finally {
                  setResearchLoading(false);
                }
              }}
            >
              {researchLoading ? 'Researching & saving…' : 'Research & add to pipeline'}
            </Button>
          </CardContent>
        </Card>

        {/* Add by Twitter handles (Social API) — one or multiple */}
        <Card className="bg-card border-border border-primary/20">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <AtSign className="w-4 h-4 text-primary" />
              <CardTitle className="text-xs font-semibold font-mono">Add by Twitter handles (Social API)</CardTitle>
              <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">SOCIALAPI_API_KEY</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Enter one or more Twitter handles (comma or space separated). Fetches from Social API and saves each as an entity + pipeline lead.</p>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="grid gap-2">
              <label className="text-[10px] font-mono text-muted-foreground">Twitter handle(s)</label>
              <Input
                placeholder="@eigenlayer, @0xPolygon, polygon"
                value={twitterHandlesInput}
                onChange={(e) => setTwitterHandlesInput(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <Button
              size="sm"
              className="h-8"
              disabled={twitterFetchLoading || !twitterHandlesInput.trim()}
              onClick={async () => {
                setTwitterFetchLoading(true);
                try {
                  const handles = twitterHandlesInput
                    .split(/[\s,]+/)
                    .map((h) => h.trim())
                    .filter(Boolean);
                  const res = await fetch('/api/twitter/fetch-and-save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ handles }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    toast.error(data?.error || 'Failed');
                    if (data?.details) toast.error(data.details);
                    return;
                  }
                  const n = data?.created?.length ?? 0;
                  if (n > 0) {
                    toast.success(data?.message ?? `Saved ${n} account(s) to DB.`);
                    setTwitterHandlesInput('');
                    refetchLeads();
                    queryClient.invalidateQueries({ queryKey: ['entities-research'] });
                    queryClient.invalidateQueries({ queryKey: ['entities-leadgen'] });
                    setActiveView('pipeline');
                  }
                  if (data?.failed?.length > 0) {
                    data.failed.forEach((f: { handle: string; reason: string }) => toast.error(`${f.handle}: ${f.reason}`));
                  }
                  if (data?.skipped?.length > 0 && n === 0) {
                    toast.info(data.skipped.map((s: { handle: string }) => s.handle).join(', ') + ' already in DB.');
                  }
                } catch (e) {
                  toast.error('Something went wrong');
                } finally {
                  setTwitterFetchLoading(false);
                }
              }}
            >
              {twitterFetchLoading ? 'Fetching & saving…' : 'Fetch from Social API & save'}
            </Button>
          </CardContent>
        </Card>

        {/* Luma events: company name → show already scraped events from DB */}
        <Card className="bg-card border-border border-primary/20">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <CardTitle className="text-xs font-semibold font-mono">Luma events</CardTitle>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Enter company name to see Luma events (already scraped, last 12 months, saved in DB).</p>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="grid gap-2">
              <label className="text-[10px] font-mono text-muted-foreground">Company name</label>
              <Input
                placeholder="e.g. Polygon"
                value={lumaCompany}
                onChange={(e) => setLumaCompany(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              className="h-8"
              disabled={lumaLoading || !lumaCompany.trim()}
              onClick={async () => {
                const company = lumaCompany.trim();
                if (!company) {
                  toast.error('Enter company name');
                  return;
                }
                setLumaLoading(true);
                setLumaDisplayEvents([]);
                try {
                  const res = await fetch(`/api/luma/events/for-company?company=${encodeURIComponent(company)}`);
                  if (!res.ok) throw new Error('Failed to fetch');
                  const data = await res.json();
                  setLumaDisplayEvents(Array.isArray(data) ? data : []);
                  if (!Array.isArray(data) || data.length === 0) {
                    toast.info(`No events for "${company}". Add Luma URLs in backend (src/lib/luma-urls.ts) for this company.`);
                  } else {
                    toast.success(`${data.length} events`);
                  }
                } catch {
                  toast.error('Could not load events');
                } finally {
                  setLumaLoading(false);
                }
              }}
            >
              {lumaLoading ? 'Loading…' : 'Show events'}
            </Button>
            {lumaDisplayEvents.length > 0 && (
              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="p-2 text-left font-mono">Event</th>
                      <th className="p-2 text-left font-mono">Date</th>
                      <th className="p-2 text-left font-mono">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lumaDisplayEvents.map((evt) => (
                      <tr key={evt.id} className="border-b border-border">
                        <td className="p-2 font-medium">{evt.title}</td>
                        <td className="p-2 text-muted-foreground">{evt.event_date ?? '—'}</td>
                        <td className="p-2">
                          <a href={evt.url} target="_blank" rel="noreferrer" className="text-primary underline">Open</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Luma events – shown when searching by company name */}
        {searchTrimmed && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-semibold font-mono uppercase">
                Saved events for &quot;{searchTrimmed}&quot;
              </h3>
            </div>
            {savedLumaEvents.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-[11px] text-muted-foreground italic">No Luma events for this company. Add Luma URLs for the company in backend (src/lib/luma-urls.ts) to fetch events.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="p-2 text-left font-mono">Event</th>
                      <th className="p-2 text-left font-mono">Date</th>
                      <th className="p-2 text-left font-mono">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedLumaEvents.map((evt: { id: string; title: string; url: string; event_date: string | null }) => (
                      <tr key={evt.id} className="border-b border-border">
                        <td className="p-2 font-medium">{evt.title}</td>
                        <td className="p-2 text-muted-foreground">{evt.event_date ?? '—'}</td>
                        <td className="p-2">
                          <a href={evt.url} target="_blank" rel="noreferrer" className="text-primary underline">Open</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Recent research (from database) – filtered by search */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bookmark className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-semibold font-mono uppercase">
              Recent research (entities)
              {searchTrimmed && (
                <span className="font-normal text-muted-foreground ml-2">
                  — filtering by &quot;{searchTrimmed}&quot;
                </span>
              )}
            </h3>
          </div>
          <div className="space-y-3">
            {entitiesLoading ? (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-[11px] text-muted-foreground">Searching…</p>
                </CardContent>
              </Card>
            ) : entities.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-[11px] text-muted-foreground italic">
                    {searchTrimmed
                      ? `No companies match "${searchTrimmed}". Add it above using "Research & add to pipeline".`
                      : "No companies yet. Add one above using the form."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              entities.slice(0, 10).map((ent: { id: string; name: string; overview: string | null; category: string[]; fit_score: number | null; created_at: string }) => (
                <Card key={ent.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-semibold">{ent.name}</h4>
                        <span className="text-[10px] font-mono text-muted-foreground">{ent.created_at?.slice(0, 10)}</span>
                      </div>
                      {ent.fit_score != null && (
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-mono',
                          ent.fit_score >= 70 ? 'bg-success/10 text-success' : ent.fit_score >= 40 ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
                        )}>
                          Fit {ent.fit_score}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-secondary-foreground leading-relaxed line-clamp-2">{ent.overview || '—'}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(ent.category ?? []).map((c: string) => (
                        <span key={c} className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono text-muted-foreground">{c}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
