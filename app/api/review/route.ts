import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ReviewResult } from "@/types/review";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a senior B2B marketing strategist with deep expertise in conversion copywriting, ICP targeting, and EU market compliance. Review the submitted ad or landing page copy and score it across four dimensions.

Respond with ONLY a raw JSON object. No markdown, no code fences, no explanation. Start with { and end with }.

Scoring dimensions (each 0–25 points):

1. icpFit — How precisely does the copy speak to the ideal customer profile? Does it address their role, pain points, industry, and awareness stage?

2. valueProp — How clearly and quickly does the copy translate features into tangible business benefits? Is the unique value obvious within 5 seconds?

3. ctaStrength — How compelling and funnel-stage-aligned is the CTA? Does it create urgency, reduce friction, and match the buyer's readiness?

4. euLocalization — How appropriate is the tone, vocabulary, and legal language for EU audiences? Are GDPR/consent obligations addressed where relevant?

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

export async function POST(req: NextRequest) {
  try {
    const { copy } = await req.json();

    if (!copy || typeof copy !== "string" || copy.trim().length === 0) {
      return NextResponse.json({ error: "No copy provided." }, { status: 400 });
    }

    if (copy.trim().length > 10_000) {
      return NextResponse.json({ error: "Copy exceeds 10 000 character limit." }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // Cache the large system prompt so repeated requests are cheaper
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Review this marketing copy:\n\n${copy.trim()}`,
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
