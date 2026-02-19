import { NextResponse } from "next/server";
import { searchGoogle, type GoogleSearchResult } from "@/lib/ingestion/google";
import { scrapeWebsite } from "@/lib/ingestion/website";
import { callOpenRouter, cleanJSON } from "@/lib/openrouter";

const TEAM_TYPES = ["speaker", "media", "partnerships", "sponsorship", "devrel", "ecosystem"] as const;

const TEAM_DESCRIPTIONS: Record<string, string> = {
  speaker: "People/companies relevant as speakers at events",
  media: "Media outlets, journalists, content creators",
  partnerships: "Companies for strategic partnerships",
  sponsorship: "Companies that could sponsor events",
  devrel: "Developer relations, dev tools, SDKs, developer communities",
  ecosystem: "Broader ecosystem players, VCs, DAOs, protocols",
};

function buildPrompt(teams: string[]): string {
  const teamLines = teams
    .map((t) => `- ${t}: ${TEAM_DESCRIPTIONS[t] ?? t}`)
    .join("\n");

  return `You are a lead generation analyst for HEM, a web3 events and partnerships company.
The user has selected the following team(s) to generate leads for:
${teamLines}

Based on the research data provided, generate a list of potential leads.
Each lead MUST be assigned to one of the selected teams above based on best fit.
ONLY use the teams listed above — do NOT assign leads to any other team.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "leads": [
    {
      "name": "Company/Person name",
      "description": "Brief description of who they are and why they're relevant",
      "team": "one of the selected teams",
      "relevanceScore": 1-100,
      "website": "URL if found",
      "twitter": "@handle if found",
      "reasoning": "Why this lead belongs to this team"
    }
  ]
}

Generate 5-15 leads. Prioritize quality and relevance. Assign each lead to the SINGLE most appropriate team from the selected teams.`;
}

interface GeneratedLead {
  name: string;
  description: string;
  team: (typeof TEAM_TYPES)[number];
  relevanceScore: number;
  website?: string;
  twitter?: string;
  reasoning: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = body?.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    // Validate selected teams (default to all if none provided)
    const requestedTeams: string[] = Array.isArray(body?.teams) ? body.teams : [];
    const selectedTeams = requestedTeams.length > 0
      ? requestedTeams.filter((t: string) => TEAM_TYPES.includes(t as (typeof TEAM_TYPES)[number]))
      : [...TEAM_TYPES];

    if (selectedTeams.length === 0) {
      return NextResponse.json({ error: "At least one valid team is required" }, { status: 400 });
    }

    // Step 1: SerpAPI search for relevant results
    const serpResults = await searchGoogle(query);

    // Step 2: Scrape top 3 URLs for deeper context (Firecrawl → Jina fallback)
    const topUrls = serpResults
      .slice(0, 3)
      .map((r) => r.link)
      .filter(Boolean);

    const scrapeSettled = await Promise.allSettled(
      topUrls.map((url) => scrapeWebsite(url))
    );

    const scrapedContent = scrapeSettled
      .map((s, i) => {
        if (s.status === "fulfilled" && s.value) {
          return {
            url: topUrls[i],
            title: s.value.title,
            content: s.value.content.slice(0, 2000),
          };
        }
        return null;
      })
      .filter(Boolean);

    // Step 3: Send everything to OpenRouter LLM
    const researchData = JSON.stringify({
      query,
      searchResults: serpResults.slice(0, 10).map((r) => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet,
      })),
      scrapedPages: scrapedContent,
    });

    const llmResponse = await callOpenRouter([
      { role: "system", content: buildPrompt(selectedTeams) },
      {
        role: "user",
        content: `Generate leads for this query: "${query}"\n\nResearch data:\n${researchData}`,
      },
    ]);

    let parsed: { leads: GeneratedLead[] };
    try {
      parsed = JSON.parse(cleanJSON(llmResponse));
    } catch {
      parsed = { leads: [] };
    }

    // Validate team assignments
    const validLeads = (parsed.leads ?? [])
      .filter((l) => l.name && TEAM_TYPES.includes(l.team as (typeof TEAM_TYPES)[number]))
      .map((l) => ({
        ...l,
        relevanceScore: Math.min(100, Math.max(0, l.relevanceScore ?? 50)),
      }));

    return NextResponse.json({
      leads: validLeads,
      searchResultsCount: serpResults.length,
      scrapedPagesCount: scrapedContent.length,
    });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    console.error("[leadgen/generate] error:", details);
    return NextResponse.json(
      { error: "Lead generation failed", details },
      { status: 500 }
    );
  }
}
