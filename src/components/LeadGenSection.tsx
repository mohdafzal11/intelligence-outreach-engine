import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { TEAM_LABELS, TeamType } from '@/types/crm';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useCRM } from '@/contexts/CRMContext';

function AddToPipelineButton({
  entityId,
  entityName,
  isAdded,
  onAdded,
}: {
  entityId: string;
  entityName: string;
  isAdded: boolean;
  onAdded: () => void;
}) {
  const { refetchLeads } = useCRM();
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, wrapperType: 'sponsor_devrel' }),
      });
      const data = await res.json();
      if (data?.existing) {
        onAdded();
        refetchLeads();
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Failed');
      onAdded();
      refetchLeads();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={isAdded ? 'secondary' : 'default'}
      className="h-7 text-[11px] font-mono shrink-0 ml-4"
      onClick={handleAdd}
      disabled={isAdded || loading}
    >
      {isAdded ? (
        <>
          <CheckCircle className="w-3 h-3 mr-1" />
          Added
        </>
      ) : loading ? (
        'Adding…'
      ) : (
        <>
          <UserPlus className="w-3 h-3 mr-1" />
          Add to pipeline
        </>
      )}
    </Button>
  );
}

export default function LeadGenSection() {
  const { leads } = useCRM();
  const [search, setSearch] = useState('');
  const [addedLeads, setAddedLeads] = useState<Set<string>>(new Set());

  const pipelineEntityIds = new Set(leads.map((l) => l.entityId).filter(Boolean) as string[]);

  const { data: entities = [] } = useQuery({
    queryKey: ['entities-leadgen', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/entities?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleAddLead = (id: string) => {
    setAddedLeads((prev) => new Set(prev).add(id));
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-auto">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold font-mono">LEAD GENERATION</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Find and qualify new leads for any team</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-[11px] text-muted-foreground">
              Entities from database. Search below. Add to pipeline to move them to the Pipeline view.
            </p>
            <Input
              placeholder="Search entities by name or overview..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2 h-8 text-xs bg-muted border-border"
            />
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold font-mono uppercase">Entities (from DB)</h3>
            <span className="text-[10px] text-muted-foreground font-mono">{entities.length} found</span>
          </div>

          <div className="space-y-3">
            {entities.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-[11px] text-muted-foreground italic">No entities. Research companies first to add them to the database.</p>
                </CardContent>
              </Card>
            ) : (
              entities.map((ent: { id: string; name: string; overview: string | null; category: string[]; fit_score: number | null }) => {
                const isAdded = addedLeads.has(ent.id) || pipelineEntityIds.has(ent.id);
                return (
                  <Card key={ent.id} className={cn('bg-card border-border transition-colors', isAdded && 'border-success/30')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold">{ent.name}</h4>
                            {ent.fit_score != null && (
                              <span className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
                                ent.fit_score >= 70 ? 'bg-success/10 text-success' : ent.fit_score >= 40 ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                              )}>
                                Fit {ent.fit_score}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-secondary-foreground mb-2 line-clamp-2">{ent.overview || '—'}</p>
                          <div className="flex gap-1 flex-wrap">
                            {(ent.category ?? []).map((t: string) => (
                              <span key={t} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">{t}</span>
                            ))}
                          </div>
                        </div>
                        <AddToPipelineButton entityId={ent.id} entityName={ent.name} isAdded={isAdded} onAdded={() => handleAddLead(ent.id)} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
