import { useCRM } from '@/contexts/CRMContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Linkedin, Twitter, Send, MessageCircle, Sparkles, Copy, Clock, CheckCircle, Save } from 'lucide-react';
import { useState } from 'react';
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

const draftTemplates: Record<string, string> = {
  email: `Hi [Name],

I'm reaching out regarding India Blockchain Week (IBW) 2026, happening this November in Bangalore.

Given your work on [topic] at [company], we believe you'd be an incredible addition to our [track] track. Your perspective on [specific insight] would resonate strongly with our audience of 5,000+ builders and operators.

Would you be open to a quick call to discuss potential involvement?

Best regards,
[Your Name]
IBW Team`,
  linkedin: `Hey [Name] 👋

Following your work at [company] — really impressed by [recent activity]. We're putting together IBW 2026 and your expertise on [topic] would be a perfect fit for our audience.

Would love to chat about potential collaboration. Open to a quick call?`,
  twitter: `Hey @[handle] — love what you're building at [company]. We're organizing IBW 2026 in Bangalore this Nov and think your take on [topic] would be 🔥 for our community. Mind if I DM details?`,
  telegram: `Hi [Name]! Reaching out from IBW team. We're organizing India Blockchain Week 2026 and given your work on [topic], we'd love to explore having you involved. Happy to share more details — would you have 15 mins this week?`,
  whatsapp: `Hi [Name], this is [Your Name] from the IBW team. We're putting together India Blockchain Week 2026 and your work at [company] on [topic] really stands out. Would love to discuss potential involvement — are you free for a quick call?`,
};

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
  const [selectedOutreachLead, setSelectedOutreachLead] = useState<Lead | null>(null);
  const [draft, setDraft] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<'sent' | 'draft' | null>(null);

  const pendingOutreach = filteredLeads.filter(
    (l) => l.status === 'not_contacted' || l.status === 'reached_out'
  );

  const handleGenerateDraft = (lead: Lead) => {
    setSelectedOutreachLead(lead);
    let template = draftTemplates[selectedChannel] || draftTemplates.email;
    template = template
      .replace(/\[Name\]/g, lead.name.split(' ')[0])
      .replace(/\[company\]/g, lead.company)
      .replace(/\[topic\]/g, lead.topics[0] || 'Web3')
      .replace(/\[track\]/g, lead.teams.map((t) => TEAM_LABELS[t]).join(' / '))
      .replace(/\[specific insight\]/g, lead.relevance.split(',')[0])
      .replace(/\[recent activity\]/g, lead.relevance.split('.')[0])
      .replace(/@\[handle\]/g, lead.twitter || `@${lead.name.split(' ')[0].toLowerCase()}`);
    setDraft(template);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draft);
    setCopiedId(selectedOutreachLead?.id || null);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveOutreach = async (status: 'sent' | 'draft') => {
    const lead = selectedOutreachLead;
    if (!lead?.entityId || !lead?.wrapperType || !draft.trim()) {
      toast.error(lead ? 'Missing entity or channel. Try another lead.' : 'Select a lead and write a message.');
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
          wrapperType: lead.wrapperType,
          channel,
          subject: selectedChannel === 'email' ? `IBW 2026 – ${lead.company}` : null,
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
      toast.success(status === 'sent' ? 'Logged as sent in database.' : 'Saved as draft in database.');
      queryClient.invalidateQueries({ queryKey: ['outreach-summary'] });
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      refetchLeads();
      setDraft('');
      setSelectedOutreachLead(null);
    } catch (e) {
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
              onClick={() => handleGenerateDraft(lead)}
              className={cn(
                'w-full text-left px-4 py-3 border-b border-border/50 transition-colors',
                selectedOutreachLead?.id === lead.id ? 'bg-secondary/80' : 'hover:bg-secondary/40'
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
              <p className="text-xs text-muted-foreground">All leads have been contacted</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Draft Composer */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold font-mono">OUTREACH COMPOSER</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Draft personalized messages with AI assistance</p>
            </div>
          </div>

          {/* Channel Selector */}
          <div className="flex gap-1 mt-3">
            {channelConfig.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSelectedChannel(key)}
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
          {selectedOutreachLead ? (
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">TO:</span>
                <span className="font-medium text-foreground">{selectedOutreachLead.name}</span>
                <span>· {selectedOutreachLead.company}</span>
                <span>· via {channelConfig.find((c) => c.key === selectedChannel)?.label}</span>
              </div>

              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[300px] text-xs bg-muted border-border font-sans leading-relaxed"
              />

              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" className="h-7 text-[11px] font-mono" onClick={handleCopy}>
                  {copiedId === selectedOutreachLead.id ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy to Clipboard
                    </>
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
                  {saving === 'draft' ? 'Saving…' : 'Save as draft'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-[11px] font-mono"
                  disabled={saving !== null}
                  onClick={() => handleSaveOutreach('sent')}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {saving === 'sent' ? 'Saving…' : 'Log as Sent'}
                </Button>
                <Button size="sm" variant="secondary" className="h-7 text-[11px] font-mono">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Refine with AI
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Select a lead from the queue to draft outreach</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
