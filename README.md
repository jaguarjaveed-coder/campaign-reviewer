# Campaign Copy Reviewer

Paste ad or landing page copy; get a structured score across four B2B marketing dimensions and a suggested rewrite — powered by Claude.

**Live demo:** https://campaign-reviewer.onrender.com

---

## Why these four dimensions

Each dimension maps to a recurring failure mode I've seen kill B2B SaaS campaigns over eight years of performance marketing work:

| Dimension | What it catches |
|---|---|
| **ICP / Persona Fit** | Copy written for "everyone" converts no one. Most teams write for the product, not the buyer. This dimension checks whether the copy addresses a specific role, pain point, and awareness stage. |
| **Value Proposition Clarity** | Feature lists masquerading as benefits. If a reader has to infer why something matters, the copy fails. This catches the gap between "what it does" and "what it means for you." |
| **CTA Strength & Funnel Alignment** | Generic CTAs ("Learn more", "Get started") destroy conversion at every funnel stage. A discovery-stage visitor and a trial-expired user need different asks. |
| **EU Localization & GDPR Language** | US-style urgency copy lands badly in DE/NL/FR markets. Phrases like "Act now — limited spots!" read as pressure tactics. GDPR consent language is also frequently missing or wrong, creating compliance risk. |

Each dimension scores 0–25. Total is 100.

---

## Architecture

```
app/
├── api/review/route.ts   Server-side POST handler. Validates input, calls
│                         claude-sonnet-4-6, strips any markdown wrapping,
│                         parses the JSON response, returns ReviewResult.
├── page.tsx              Client component. Textarea → fetch → score cards
│                         + rewrite panel. No state management library.
└── layout.tsx            Root layout, Inter font, Tailwind base styles.

types/
└── review.ts             Shared ReviewResult / DimensionScore types.
                          Single source of truth used by both route and UI.
```

**Key decisions:**

- **Server-side API call only.** The Anthropic key never touches the client. Next.js App Router route handlers run on the server.
- **Prompt caching.** The system prompt is tagged `cache_control: ephemeral`. Repeated reviews against the same prompt hit the cache and cost roughly 10× less per token.
- **Strict JSON contract.** The system prompt instructs the model to return raw JSON starting with `{`. A regex fallback strips markdown code fences before `JSON.parse` in case the model wraps anyway.
- **Shared types.** `ReviewResult` is defined once in `types/review.ts` and imported by both the route handler and the page component — the TypeScript compiler catches any drift.

---

## Run locally

```bash
git clone https://github.com/your-org/campaign-reviewer.git
cd campaign-reviewer

cp .env.local.example .env.local
# open .env.local and set ANTHROPIC_API_KEY=sk-ant-...

npm install
npm run dev
# http://localhost:3000
```

Requires Node 18+. No database, no external services beyond the Anthropic API.

---

## Production Roadmap

What would need to change before handing this to a real marketing team:

**Rate limiting per user**
Currently there is no rate limiting. Any authenticated user (or anonymous caller) can hit `/api/review` without restriction. The fix is a Redis-backed sliding window per user ID / IP, enforced as middleware before the route handler. Upstash is the obvious choice for a serverless deployment.

**Response streaming**
The current implementation waits for the full model response before returning anything — typically 5–8 seconds. Switching to `client.messages.stream()` and forwarding a `ReadableStream` to the client would let the UI render each dimension card as it arrives, cutting perceived latency significantly.

**Saved review history**
Right now every review is stateless. A `reviews` table (Postgres via Supabase or Neon) keyed on `user_id + created_at` would let teams track copy performance over time, compare rewrites, and share results with stakeholders via a permalink.

**Langdock skill integration**
The `/api/review` endpoint is already structured as a clean JSON API. Wrapping it as a Langdock skill would let teams trigger a review directly from Slack or their internal AI assistant without opening the web UI.

**Multi-language EU support (DE / FR / NL)**
The current scoring and rewrite prompt is English-only. Supporting DE/FR/NL would require: detecting or accepting the target-market language as an input parameter, translating the rubric context for that locale, and generating the rewrite in the correct language. The model handles this well; the work is in the prompt layer and the UI language selector.

---

## License

MIT
