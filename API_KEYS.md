# API Keys & Environment Variables

Put these in **`.env.local`** at the project root. Never commit real keys to git.

---

## Required (app won’t work without these)

| Variable | Where to get it | Used for |
|----------|------------------|----------|
| **NEXT_PUBLIC_SUPABASE_URL** | Supabase Dashboard → Project Settings → API → Project URL | Database + auth base URL |
| **SUPABASE_SERVICE_ROLE_KEY** | Same → `service_role` (secret) key | Backend DB access (bypass RLS) |
| **ANTHROPIC_API_KEY** | [console.anthropic.com](https://console.anthropic.com) → API Keys | Claude: insights, outreach drafts, follow-ups, pitch suggestions, proposals |

---

## Optional – Data ingestion (better research data)

| Variable | Where to get it | Used for |
|----------|------------------|----------|
| **FIRECRAWL_API_KEY** | [firecrawl.dev](https://firecrawl.dev) | Scraping company websites (fallback: Jina Reader) |
| **SERPAPI_API_KEY** | [serpapi.com](https://serpapi.com) | Google search results for company + web3/sponsorship |
| **TWITTER_BEARER_TOKEN** | [developer.twitter.com](https://developer.twitter.com) → Project → Keys → Bearer Token | Twitter profile + recent tweets (used when Social API key is not set) |
| **SOCIALAPI_API_KEY** | [SocialAPI](https://api.socialapi.me) dashboard (not the open-docs URL) | Fetch Twitter user data via Social API; used for “Add by Twitter handles” and preferred over Twitter API when set |
| **PROXYCURL_API_KEY** | [nubela.co/proxycurl](https://nubela.co/proxycurl) | Company enrichment (LinkedIn resolve + profile) |
| **GITHUB_TOKEN** | [github.com/settings/tokens](https://github.com/settings/tokens) (optional) | GitHub org + repos (higher rate limit with token) |
| **LUMA_API_KEY** | [Luma](https://lu.ma) → Calendar → API (Luma Plus) | Upcoming events for ecosystem context |

---

## Optional – Background jobs

| Variable | Where to get it | Used for |
|----------|------------------|----------|
| **INNGEST_SIGNING_KEY** | [inngest.com](https://inngest.com) → App → Keys | Verify Inngest webhooks (production) |
| **INNGEST_EVENT_KEY** | Same | Send events to Inngest (if you trigger from app) |

For local dev you can run `npx inngest-cli@latest dev` and leave these unset.

---

## Summary table

| Key | Required? | Purpose |
|-----|-----------|--------|
| NEXT_PUBLIC_SUPABASE_URL | Yes | Supabase URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase service role |
| ANTHROPIC_API_KEY | Yes | Claude AI |
| FIRECRAWL_API_KEY | No | Website scrape |
| SERPAPI_API_KEY | No | Google search |
| TWITTER_BEARER_TOKEN | No | Twitter data (fallback when Social API not set) |
| SOCIALAPI_API_KEY | No | Twitter via Social API (add by handle(s), research) |
| PROXYCURL_API_KEY | No | Company enrichment |
| GITHUB_TOKEN | No | GitHub org/repos |
| LUMA_API_KEY | No | Luma events |
| INNGEST_SIGNING_KEY | No | Inngest (prod) |
| INNGEST_EVENT_KEY | No | Inngest (prod) |

---

## Example `.env.local`

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...

# Optional – ingestion
FIRECRAWL_API_KEY=
SERPAPI_API_KEY=
TWITTER_BEARER_TOKEN=
SOCIALAPI_API_KEY=
PROXYCURL_API_KEY=
GITHUB_TOKEN=
LUMA_API_KEY=

# Optional – Inngest (production)
INNGEST_SIGNING_KEY=
INNGEST_EVENT_KEY=
```
