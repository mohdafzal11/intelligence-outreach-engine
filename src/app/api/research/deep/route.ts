import { NextResponse } from "next/server";
import { searchGoogle, type GoogleSearchResult } from "@/lib/ingestion/google";
import { searchTwitter, type TwitterSearchResult } from "@/lib/ingestion/social-api";
import { callOpenRouter, cleanJSON } from "@/lib/openrouter";

const MAX_ROUNDS = 2;

const ANALYSIS_PROMPT = `You are a deep research analyst. Analyze the provided search results and Twitter data about the given query.
Return ONLY valid JSON (no markdown fences) with these fields:
- summary: string (2-3 paragraph comprehensive analysis)
- keyFindings: string[] (5-8 key findings as bullet points)
- twitterInsights: string (summary of what Twitter/social media reveals)
- webInsights: string (summary of what web search reveals)
- followUpQueries: string[] (2-3 follow-up search queries that would deepen understanding)`;

const SYNTHESIS_PROMPT = `You are a deep research analyst. You have data from multiple rounds of research on a topic.
Synthesize ALL information into a comprehensive final analysis.
Return ONLY valid JSON (no markdown fences) with:
- summary: string (3-4 paragraph final analysis)
- keyFindings: string[] (8-12 most important findings, deduplicated)
- twitterInsights: string (consolidated social media analysis)
- webInsights: string (consolidated web research analysis)`;

interface Source {
  title: string;
  url: string;
  type: "web" | "twitter";
}

function deduplicateWeb(results: GoogleSearchResult[]): GoogleSearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.link)) return false;
    seen.add(r.link);
    return true;
  });
}

function deduplicateTweets(tweets: TwitterSearchResult[]): TwitterSearchResult[] {
  const seen = new Set<string>();
  return tweets.filter((t) => {
    const key = t.text.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSources(web: GoogleSearchResult[], twitter: TwitterSearchResult[]): Source[] {
  const sources: Source[] = [];
  const seen = new Set<string>();
  for (const r of deduplicateWeb(web)) {
    if (r.link && !seen.has(r.link)) {
      seen.add(r.link);
      sources.push({ title: r.title, url: r.link, type: "web" });
    }
  }
  for (const t of twitter) {
    if (t.user?.username) {
      const url = `https://twitter.com/${t.user.username}`;
      if (!seen.has(url)) {
        seen.add(url);
        sources.push({ title: `@${t.user.username}`, url, type: "twitter" });
      }
    }
  }
  return sources;
}

function safeParse(text: string, fallback: Record<string, unknown> = {}) {
  try {
    return JSON.parse(cleanJSON(text));
  } catch {
    return { summary: text, keyFindings: [], followUpQueries: [], ...fallback };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = body?.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const maxRounds = Math.min(body?.maxRounds ?? MAX_ROUNDS, 3);
    const allWebResults: GoogleSearchResult[] = [];
    const allTwitterResults: TwitterSearchResult[] = [];
    const allFollowUpQueries: string[] = [];

    // --- ROUND 1: parallel fetch ---
    const [webSettled, twitterSettled] = await Promise.allSettled([
      searchGoogle(query),
      searchTwitter(query),
    ]);

    const web1 = webSettled.status === "fulfilled" ? webSettled.value : [];
    const twitter1 = twitterSettled.status === "fulfilled" ? twitterSettled.value : [];
    allWebResults.push(...web1);
    allTwitterResults.push(...twitter1);

    // --- ROUND 1: LLM analysis ---
    const round1Data = JSON.stringify({
      query,
      webResults: web1.slice(0, 10),
      twitterResults: twitter1.slice(0, 20),
    });

    const round1Raw = await callOpenRouter([
      { role: "system", content: ANALYSIS_PROMPT },
      { role: "user", content: `Research query: "${query}"\n\nData:\n${round1Data}` },
    ]);

    const parsed1 = safeParse(round1Raw);
    const followUps: string[] = (parsed1.followUpQueries ?? []).slice(0, 3);
    allFollowUpQueries.push(...followUps);

    let roundsExecuted = 1;

    // --- ROUND 2+: recursive follow-up queries ---
    if (followUps.length > 0 && roundsExecuted < maxRounds) {
      const followUpResults = await Promise.all(
        followUps.map(async (fq: string) => {
          const [webR, twitterR] = await Promise.allSettled([
            searchGoogle(fq),
            searchTwitter(fq),
          ]);
          return {
            query: fq,
            web: webR.status === "fulfilled" ? webR.value : [],
            twitter: twitterR.status === "fulfilled" ? twitterR.value : [],
          };
        })
      );

      for (const fr of followUpResults) {
        allWebResults.push(...fr.web);
        allTwitterResults.push(...fr.twitter);
      }
      roundsExecuted = 2;

      // --- FINAL SYNTHESIS ---
      const allData = JSON.stringify({
        originalQuery: query,
        round1Analysis: parsed1,
        followUpData: followUpResults.map((fr) => ({
          query: fr.query,
          webResults: fr.web.slice(0, 8),
          twitterResults: fr.twitter.slice(0, 15),
        })),
      });

      const finalRaw = await callOpenRouter([
        { role: "system", content: SYNTHESIS_PROMPT },
        { role: "user", content: `Original query: "${query}"\n\nAll research data:\n${allData}` },
      ]);

      const parsedFinal = safeParse(finalRaw);
      const sources = buildSources(allWebResults, allTwitterResults);

      return NextResponse.json({
        summary: parsedFinal.summary ?? parsed1.summary ?? "",
        keyFindings: parsedFinal.keyFindings ?? parsed1.keyFindings ?? [],
        twitterInsights: {
          summary: parsedFinal.twitterInsights ?? "",
          tweets: deduplicateTweets(allTwitterResults).slice(0, 20),
        },
        webResults: {
          summary: parsedFinal.webInsights ?? "",
          results: deduplicateWeb(allWebResults).slice(0, 15),
        },
        followUpQueries: allFollowUpQueries,
        sources,
        rounds: roundsExecuted,
      });
    }

    // --- Single round response (no follow-ups) ---
    const sources = buildSources(allWebResults, allTwitterResults);
    return NextResponse.json({
      summary: parsed1.summary ?? "",
      keyFindings: parsed1.keyFindings ?? [],
      twitterInsights: {
        summary: parsed1.twitterInsights ?? "",
        tweets: allTwitterResults.slice(0, 20),
      },
      webResults: {
        summary: parsed1.webInsights ?? "",
        results: allWebResults.slice(0, 15),
      },
      followUpQueries: allFollowUpQueries,
      sources,
      rounds: roundsExecuted,
    });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    console.error("[research/deep] error:", details);
    return NextResponse.json({ error: "Deep research failed", details }, { status: 500 });
  }
}
