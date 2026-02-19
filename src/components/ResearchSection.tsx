import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, Sparkles, Globe, AtSign, ExternalLink, FileText } from 'lucide-react';
import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TwitterResult {
  text: string;
  user: { name: string; username: string };
  created_at?: string;
}

interface WebResult {
  title: string;
  link: string;
  snippet: string;
}

interface Source {
  title: string;
  url: string;
  type: 'web' | 'twitter';
}

interface DeepResearchResponse {
  summary: string;
  keyFindings: string[];
  twitterInsights: { summary: string; tweets: TwitterResult[] };
  webResults: { summary: string; results: WebResult[] };
  followUpQueries: string[];
  sources: Source[];
  rounds: number;
}

const EXAMPLE_QUERIES = [
  'EigenLayer restaking ecosystem',
  'Polygon web3 sponsorship events',
  'Arbitrum ecosystem grants 2025',
];

export default function ResearchSection() {
  const [query, setQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [progress, setProgress] = useState({ message: '', percent: 0 });
  const [results, setResults] = useState<DeepResearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const handleResearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || isResearching) return;

    setIsResearching(true);
    setResults(null);
    setError(null);
    setProgress({ message: 'Searching web & Twitter...', percent: 15 });

    clearTimers();
    timersRef.current.push(
      setTimeout(() => setProgress({ message: 'AI analyzing initial results...', percent: 40 }), 3000),
      setTimeout(() => setProgress({ message: 'Running follow-up queries...', percent: 65 }), 8000),
      setTimeout(() => setProgress({ message: 'Synthesizing final analysis...', percent: 85 }), 14000),
    );

    try {
      const res = await fetch('/api/research/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });

      clearTimers();
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? 'Research failed');
        toast.error(data?.details ?? data?.error ?? 'Research failed');
        return;
      }

      setProgress({ message: 'Complete!', percent: 100 });
      setResults(data);
      toast.success(`Research complete — ${data.rounds} round(s), ${data.sources?.length ?? 0} sources`);
    } catch (e) {
      clearTimers();
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsResearching(false);
      setTimeout(() => setProgress({ message: '', percent: 0 }), 1500);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-auto">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold font-mono">RESEARCH HUB</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Enter any query — AI searches the web & Twitter, analyzes results, then runs follow-up queries for deeper insights.
        </p>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Search Input */}
        <Card className="bg-card border-border border-primary/30 shadow-sm">
          <CardContent className="p-5">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter your research query..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
                  className="pl-10 h-12 text-sm bg-muted border-border"
                  disabled={isResearching}
                />
              </div>
              <Button
                onClick={handleResearch}
                disabled={isResearching || !query.trim()}
                className="h-12 px-6"
              >
                {isResearching ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Research
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
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
        {isResearching && (
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
            {/* AI Summary */}
            <Card className="bg-card border-border border-primary/20">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <CardTitle className="text-xs font-semibold font-mono">AI ANALYSIS</CardTitle>
                  <Badge variant="secondary" className="text-[9px]">
                    {results.rounds} round{results.rounds > 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="secondary" className="text-[9px]">
                    {results.sources.length} sources
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-[11px] text-secondary-foreground leading-relaxed whitespace-pre-line">
                  {results.summary}
                </p>
              </CardContent>
            </Card>

            {/* Tabbed Results */}
            <Tabs defaultValue="findings" className="w-full">
              <TabsList className="h-8">
                <TabsTrigger value="findings" className="text-xs">
                  Key Findings ({results.keyFindings.length})
                </TabsTrigger>
                <TabsTrigger value="twitter" className="text-xs">
                  Twitter ({results.twitterInsights.tweets.length})
                </TabsTrigger>
                <TabsTrigger value="web" className="text-xs">
                  Web ({results.webResults.results.length})
                </TabsTrigger>
                <TabsTrigger value="sources" className="text-xs">
                  Sources ({results.sources.length})
                </TabsTrigger>
              </TabsList>

              {/* Key Findings */}
              <TabsContent value="findings" className="mt-3 space-y-2">
                {results.keyFindings.map((finding, i) => (
                  <Card key={i} className="bg-card border-border">
                    <CardContent className="p-3 flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-[11px] text-secondary-foreground leading-relaxed">{finding}</p>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Twitter Insights */}
              <TabsContent value="twitter" className="mt-3 space-y-3">
                {results.twitterInsights.summary && (
                  <Card className="bg-card border-border border-accent/20">
                    <CardContent className="p-3">
                      <p className="text-[11px] text-secondary-foreground leading-relaxed">
                        {results.twitterInsights.summary}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {results.twitterInsights.tweets.map((tweet, i) => (
                  <Card key={i} className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AtSign className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-mono font-semibold">
                          {tweet.user.name || tweet.user.username}
                        </span>
                        {tweet.user.username && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            @{tweet.user.username}
                          </span>
                        )}
                        {tweet.created_at && (
                          <span className="text-[9px] text-muted-foreground ml-auto">
                            {tweet.created_at}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-secondary-foreground leading-relaxed">{tweet.text}</p>
                    </CardContent>
                  </Card>
                ))}
                {results.twitterInsights.tweets.length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic px-1">No tweets found for this query.</p>
                )}
              </TabsContent>

              {/* Web Results */}
              <TabsContent value="web" className="mt-3 space-y-3">
                {results.webResults.summary && (
                  <Card className="bg-card border-border border-accent/20">
                    <CardContent className="p-3">
                      <p className="text-[11px] text-secondary-foreground leading-relaxed">
                        {results.webResults.summary}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {results.webResults.results.map((result, i) => (
                  <Card key={i} className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <a
                            href={result.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            {result.title}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{result.link}</p>
                          <p className="text-[11px] text-secondary-foreground leading-relaxed mt-1">{result.snippet}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Sources */}
              <TabsContent value="sources" className="mt-3">
                <Card className="bg-card border-border">
                  <CardContent className="p-3 space-y-1.5">
                    {results.sources.map((source, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[9px] w-14 justify-center shrink-0',
                            source.type === 'twitter' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
                          )}
                        >
                          {source.type}
                        </Badge>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline truncate"
                        >
                          {source.title}
                        </a>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Follow-up Queries */}
            {results.followUpQueries.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">
                    Suggested follow-up queries
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {results.followUpQueries.map((fq) => (
                      <Button
                        key={fq}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          setQuery(fq);
                          setResults(null);
                        }}
                      >
                        <Search className="w-3 h-3 mr-1.5" />
                        {fq}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
