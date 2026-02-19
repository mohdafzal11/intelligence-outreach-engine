"use client";

import { useCRM } from "@/contexts/CRMContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Loader2, Send, Plus, Clock,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

type OutreachRow = {
  id: string;
  channel: string;
  status: string;
  wrapper_type: string;
  created_at: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const QUICK_PROMPTS = [
  "Give me today's pipeline summary",
  "Which leads need follow-up?",
  "Show outreach stats by channel",
  "What's our conversion rate?",
  "Suggest next steps for top leads",
];

export default function DailySummary() {
  const { leads } = useCRM();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const { data: outreachList = [] } = useQuery({
    queryKey: ["outreach-summary"],
    queryFn: async () => {
      const res = await fetch("/api/outreach");
      if (!res.ok) return [];
      return res.json() as Promise<OutreachRow[]>;
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["chat-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/summary/chat");
      if (!res.ok) return [];
      return res.json() as Promise<ChatSession[]>;
    },
  });

  const totalLeads = leads.length;
  const totalOutreach = outreachList.length;
  const totalResponded = outreachList.filter(
    (o) => o.status === "replied" || o.status === "responded"
  ).length;
  const highPriority = leads.filter((l) => l.priority === "high").length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = async (sid: string) => {
    try {
      const res = await fetch(`/api/summary/chat?sessionId=${sid}`);
      if (!res.ok) return;
      const msgs = await res.json();
      setSessionId(sid);
      setMessages(
        msgs.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    } catch {
      toast.error("Failed to load session");
    }
  };

  const startNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setInput("");
  };

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isSending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setIsSending(true);

    try {
      const res = await fetch("/api/summary/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId ?? undefined,
          message: msg,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.details ?? data?.error ?? "Failed");
        return;
      }

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 flex min-w-0 overflow-hidden">
      {/* Left: Sessions + Stats */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-semibold font-mono uppercase">
            Daily Summary
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Chat with AI about your pipeline
          </p>
        </div>

        {/* Quick Stats */}
        <div className="p-3 border-b border-border">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-md p-2">
              <span className="text-[9px] font-mono text-muted-foreground block">
                Total Leads
              </span>
              <span className="text-sm font-mono font-bold">
                {totalLeads}
              </span>
            </div>
            <div className="bg-muted rounded-md p-2">
              <span className="text-[9px] font-mono text-muted-foreground block">
                Outreach
              </span>
              <span className="text-sm font-mono font-bold text-primary">
                {totalOutreach}
              </span>
            </div>
            <div className="bg-muted rounded-md p-2">
              <span className="text-[9px] font-mono text-muted-foreground block">
                Responded
              </span>
              <span className="text-sm font-mono font-bold text-success">
                {totalResponded}
              </span>
            </div>
            <div className="bg-muted rounded-md p-2">
              <span className="text-[9px] font-mono text-muted-foreground block">
                High Priority
              </span>
              <span className="text-sm font-mono font-bold text-accent">
                {highPriority}
              </span>
            </div>
          </div>
        </div>

        {/* New Chat + Past Sessions */}
        <div className="flex-1 overflow-auto">
          <div className="p-2">
            <Button
              size="sm"
              variant="secondary"
              className="w-full h-8 text-[11px] font-mono justify-start gap-2"
              onClick={startNewSession}
            >
              <Plus className="w-3 h-3" />
              New conversation
            </Button>
          </div>
          <div className="px-2 pb-2 space-y-0.5">
            <span className="text-[9px] font-mono text-muted-foreground uppercase px-2 block py-1">
              Past chats
            </span>
            {sessions.length === 0 && (
              <p className="text-[10px] text-muted-foreground px-2 italic">
                No past conversations yet.
              </p>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-colors",
                  sessionId === s.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="truncate">{s.title || "Untitled"}</span>
                </div>
                <span className="text-[9px] text-muted-foreground pl-[18px] block">
                  {s.updated_at?.slice(0, 10)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold font-mono">
            {sessionId ? "CONVERSATION" : "DAILY SUMMARY"}
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Ask about your pipeline, outreach, team performance, or generate
            reports.
          </p>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-4">
                  Ask anything about your pipeline and outreach data
                </p>
              </div>
              <div className="flex flex-wrap gap-2 max-w-lg justify-center">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-[10px] font-mono px-3 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-3",
                  msg.role === "user"
                    ? "bg-primary/10 text-foreground"
                    : "bg-muted text-secondary-foreground"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[9px] font-mono text-primary uppercase">
                      AI Summary
                    </span>
                  </div>
                )}
                <p className="text-[11px] leading-relaxed whitespace-pre-line">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Analyzing your data...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2 max-w-2xl mx-auto">
            <Input
              placeholder="Ask about your pipeline, outreach, or generate a report..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="h-10 text-xs bg-muted border-border flex-1"
              disabled={isSending}
            />
            <Button
              onClick={() => handleSend()}
              disabled={isSending || !input.trim()}
              className="h-10 px-4"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
