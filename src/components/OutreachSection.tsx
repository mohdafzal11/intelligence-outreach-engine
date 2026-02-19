import { useCRM } from '@/contexts/CRMContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Linkedin, Twitter, Send, MessageCircle, Sparkles, Copy, Clock, CheckCircle, Save, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Lead, STATUS_LABELS, STATUS_COLORS, TEAM_LABELS } from '@/types/crm';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const channelConfig = [
  { key: 'email' as const, label: 'Email', icon: Mail },
  { key: 'linkedin' as const, label: 'LinkedIn', icon: Linkedin },
  { key: 'twitter' as const, label: 'X / DM', icon: Twitter },
  { key: 'telegram' as const, label: 'Telegram', icon: Send },
  { key: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
];

const CHANNEL_TO_API: Record<string, string> = {
  email: 'email',
  linkedin: 'linkedin_dm',
  twitter: 'twitter',
  telegram: 'telegram',
  whatsapp: 'whatsapp',
};

export default function OutreachSection() {
  const { filteredLeads, refetchLeads } = useCRM();
  const queryClient = useQueryClient();

  const [selectedChannel, setSelectedChannel] = useState<string>('email');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<'sent' | 'draft' | null>(null);

  // Cache: entityId -> channel -> { subject, body }
  const cacheRef = useRef<Record<string, Record<string, { subject: string; body: string }>>>({});

  const pendingOutreach = filteredLeads.filter(
    (l) => l.status === 'not_contacted' || l.status === 'reached_out'
  );

  // Generate message via AI
  const generateMessage = useCallback(async (lead: Lead, channel: string, customPrompt?: string) => {
    if (!lead.entityId) return;

    // Check cache (only if no custom prompt)
    if (!customPrompt) {
      const cached = cacheRef.current[lead.entityId]?.[channel];
      if (cached) {
        setDraft(cached.body);
        setSubject(cached.subject);
        return;
      }
    }

    setIsGenerating(true);
    setDraft('');
    setSubject('');

    try {
      const res = await fetch('/api/outreach/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: lead.entityId,
          channel,
          prompt: customPrompt || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.details ?? data?.error ?? 'Generation failed');
        return;
      }

      const body = data.body ?? '';
      const subj = data.subject ?? '';
      setDraft(body);
      setSubject(subj);

      // Cache result
      if (!cacheRef.current[lead.entityId]) cacheRef.current[lead.entityId] = {};
      cacheRef.current[lead.entityId][channel] = { subject: subj, body };
    } catch {
      toast.error('Failed to generate message');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Auto-select first lead on mount
  useEffect(() => {
    if (!selectedLead && pendingOutreach.length > 0) {
      const first = pendingOutreach[0];
      setSelectedLead(first);
      generateMessage(first, selectedChannel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOutreach.length]);

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setPrompt('');
    generateMessage(lead, selectedChannel);
  };

  const handleChannelSwitch = (channel: string) => {
    setSelectedChannel(channel);
    if (selectedLead) {
      generateMessage(selectedLead, channel);
    }
  };

  const handlePromptSubmit = () => {
    if (!selectedLead || !prompt.trim()) return;
    if (selectedLead.entityId && cacheRef.current[selectedLead.entityId]) {
      delete cacheRef.current[selectedLead.entityId][selectedChannel];
    }
    generateMessage(selectedLead, selectedChannel, prompt.trim());
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draft);
    setCopiedId(selectedLead?.id || null);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveOutreach = async (status: 'sent' | 'draft') => {
    const lead = selectedLead;
    if (!lead?.entityId || !draft.trim()) {
      toast.error(lead ? 'Missing entity. Try another lead.' : 'Select a lead first.');
      return;
    }
    const channel = CHANNEL_TO_API[selectedChannel] || selectedChannel;
    setSaving(status);
    try {
      const res = await fetch('/api/outreach/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: lead.entityId,
          wrapperType: lead.wrapperType || 'ecosystem',
          channel,
          subject: selectedChannel === 'email' && subject ? subject : null,
          body: draft.trim(),
          status,
          sentBy: 'Team',
        }),
      });
      const data = await res.json();
      if (data.conflict && data.warning) {
        toast.warning(data.warning);
        return;
      }
      if (!res.ok) {
        toast.error(data?.error || 'Save failed');
        return;
      }
      toast.success(status === 'sent' ? 'Logged as sent' : 'Saved as draft');
      queryClient.invalidateQueries({ queryKey: ['outreach-summary'] });
      refetchLeads();
    } catch {
      toast.error('Failed to save outreach');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex-1 flex min-w-0 overflow-hidden">
      {/* Left: Lead Queue */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-semibold font-mono uppercase">Outreach Queue</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">{pendingOutreach.length} leads pending</p>
        </div>
        <div className="flex-1 overflow-auto">
          {pendingOutreach.map((lead) => (
            <button
              key={lead.id}
              onClick={() => handleSelectLead(lead)}
              className={cn(
                'w-full text-left px-4 py-3 border-b border-border/50 transition-colors',
                selectedLead?.id === lead.id ? 'bg-secondary/80' : 'hover:bg-secondary/40'
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium">{lead.name}</span>
                <span className={cn('text-[10px]', STATUS_COLORS[lead.status])}>
                  {STATUS_LABELS[lead.status]}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">{lead.company}</span>
              <div className="flex gap-1 mt-1">
                {lead.teams.map((t) => (
                  <span key={t} className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono text-muted-foreground">
                    {TEAM_LABELS[t]}
                  </span>
                ))}
              </div>
            </button>
          ))}
          {pendingOutreach.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">No leads in queue. Add leads via Research or Lead Gen.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Composer */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold font-mono">OUTREACH COMPOSER</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            AI generates messages per channel. Switch channels to get tailored content.
          </p>

          {/* Channel Selector */}
          <div className="flex gap-1 mt-3">
            {channelConfig.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleChannelSwitch(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors',
                  selectedChannel === key
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-4 overflow-auto">
          {selectedLead ? (
            <div className="space-y-4 max-w-2xl">
              {/* To line */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">TO:</span>
                <span className="font-medium text-foreground">{selectedLead.name}</span>
                <span>· {selectedLead.company}</span>
                <span>· via {channelConfig.find((c) => c.key === selectedChannel)?.label}</span>
              </div>

              {/* Loading state */}
              {isGenerating ? (
                <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-mono">
                    Generating {channelConfig.find((c) => c.key === selectedChannel)?.label} message...
                  </span>
                </div>
              ) : (
                <>
                  {/* Subject for email */}
                  {selectedChannel === 'email' && subject && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground shrink-0">Subject:</span>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="h-7 text-xs bg-muted border-border"
                      />
                    </div>
                  )}

                  {/* Draft textarea */}
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className={cn(
                      'text-xs bg-muted border-border font-sans leading-relaxed',
                      selectedChannel === 'twitter' ? 'min-h-[100px]' : 'min-h-[300px]'
                    )}
                  />

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" className="h-7 text-[11px] font-mono" onClick={handleCopy}>
                      {copiedId === selectedLead.id ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Copied!</>
                      ) : (
                        <><Copy className="w-3 h-3 mr-1" /> Copy</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px] font-mono"
                      disabled={saving !== null}
                      onClick={() => handleSaveOutreach('draft')}
                    >
                      <Save className="w-3 h-3 mr-1" />
                      {saving === 'draft' ? 'Saving...' : 'Save Draft'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px] font-mono"
                      disabled={saving !== null}
                      onClick={() => handleSaveOutreach('sent')}
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {saving === 'sent' ? 'Saving...' : 'Log as Sent'}
                    </Button>
                  </div>
                </>
              )}

              {/* Prompt input to regenerate */}
              <div className="border-t border-border pt-4 mt-4">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block mb-2">
                  Regenerate with custom instructions
                </span>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Make it more casual, mention keynote opportunity, add urgency..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePromptSubmit()}
                    className="h-9 text-xs bg-muted border-border flex-1"
                    disabled={isGenerating}
                  />
                  <Button
                    size="sm"
                    className="h-9 px-4"
                    onClick={handlePromptSubmit}
                    disabled={isGenerating || !prompt.trim()}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Select a lead from the queue to generate outreach</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
