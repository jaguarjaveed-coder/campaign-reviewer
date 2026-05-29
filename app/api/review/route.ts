import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ReviewContext, ReviewResult } from "@/types/review";

const client = new Anthropic();

// Static preamble — cached by Anthropic so repeated calls are cheaper.
// Defines the role, output contract, and JSON shape (none of which vary per request).
const SYSTEM_PREAMBLE = `You are a senior B2B marketing strategist with deep expertise in conversion copywriting, ICP targeting, and EU market compliance.

Respond with ONLY a raw JSON object. No markdown, no code fences, no explanation. Start with { and end with }.

Required JSON shape:
{
  "totalScore": <sum of four scores>,
  "icpFit": {
    "score": <0-25>,
    "feedback": "<1-2 sentence overall assessment>",
    "issues": ["<specific issue 1>", "<specific issue 2>", "<specific issue 3>"]
  },
  "valueProp": {
    "score": <0-25>,
    "feedback": "<1-2 sentence overall assessment>",
    "issues": ["<specific issue 1>", "<specific issue 2>", "<specific issue 3>"]
  },
  "ctaStrength": {
    "score": <0-25>,
    "feedback": "<1-2 sentence overall assessment>",
    "issues": ["<specific issue 1>", "<specific issue 2>", "<specific issue 3>"]
  },
  "euLocalization": {
    "score": <0-25>,
    "feedback": "<1-2 sentence overall assessment>",
    "issues": ["<specific issue 1>", "<specific issue 2>", "<specific issue 3>"]
  },
  "rewrittenCopy": "<complete improved version addressing all identified issues>"
}

Rules:
- totalScore must equal icpFit.score + valueProp.score + ctaStrength.score + euLocalization.score
- Each issues array must have exactly 3 items
- rewrittenCopy must be a complete, publish-ready rewrite — not bullet points or instructions`;

// Builds the context-aware scoring rubric injected per request.
// Each dimension's criteria is grounded in what the user actually told us,
// rather than the model guessing the product, buyer, or target market.
function buildScoringRubric(ctx: ReviewContext): string {
  const icp = ctx.icp.trim() || "not specified — infer from the copy";
  const product = ctx.product.trim() || "not specified — infer from the copy";
  const market = ctx.targetMarket || "not specified";
  const platform = ctx.adPlatform || "not specified";

  return `Score this copy across four dimensions (each 0–25 points):

1. icpFit — Target ICP/persona: "${icp}"
   Score how well the copy speaks directly to this buyer. Does it reflect their specific role, pain points, industry context, and awareness stage? Penalise generic language that could apply to any buyer.

2. valueProp — Product/category: "${product}"
   Score how clearly and quickly the copy translates features of this product into tangible business benefits. Is the unique value obvious within 5 seconds? Penalise feature lists with no "so what."

3. ctaStrength — Ad platform: "${platform}"
   Score the CTA against what works on this platform: intent level, copy length norms, friction expectations, and funnel-stage fit. A LinkedIn Ads CTA has different conventions than a Google Ads headline or a landing page button.

4. euLocalization — Target market: "${market}"
   Score tone, vocabulary, and legal language against the norms and compliance requirements of this market. Consider: directness vs. relationship-building tone, GDPR/consent language, data-residency mentions where relevant, and whether US-style urgency tactics are appropriate for this region.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { copy, context } = body as { copy: string; context: ReviewContext };

    if (!copy || typeof copy !== "string" || copy.trim().length === 0) {
      return NextResponse.json({ error: "No copy provided." }, { status: 400 });
    }

    if (copy.trim().length > 10_000) {
      return NextResponse.json({ error: "Copy exceeds 10 000 character limit." }, { status: 400 });
    }

    const ctx: ReviewContext = {
      icp: context?.icp ?? "",
      product: context?.product ?? "",
      targetMarket: context?.targetMarket ?? "",
      adPlatform: context?.adPlatform ?? "",
    };

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PREAMBLE,
          // Cache the static preamble — output contract and JSON shape never change.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          // Scoring rubric is per-request (varies by context) so it goes in the user turn.
          content: `${buildScoringRubric(ctx)}\n\nCopy to review:\n\n${copy.trim()}`,
        },
      ],
    });

    const raw = message.content[0];
    if (raw.type !== "text") {
      throw new Error("Unexpected response type from model.");
    }

    const cleaned = raw.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const result: ReviewResult = JSON.parse(cleaned);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Model returned malformed JSON. Please try again." },
        { status: 502 }
      );
    }
    console.error("[/api/review]", err);
    return NextResponse.json({ error: "Review failed. Please try again." }, { status: 500 });
  }
}
