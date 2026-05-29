"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ReviewResult, DimensionScore, ReviewContext } from "@/types/review";

// Loaded client-side only — recharts accesses window/document during render
// and would throw on the server. The fallback keeps layout stable while it mounts.
const ScoreRadar = dynamic(() => import("@/app/components/ScoreRadar"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 h-[376px] animate-pulse" />
  ),
});

const PLACEHOLDER = `Example — paste your ad or landing page copy here:

Introducing DataPulse — the analytics platform built for modern SaaS teams.
Stop guessing. Start growing. Our real-time dashboards surface the metrics that matter
so your team can act fast, not just report fast.

✓ 5-minute setup, no engineers required
✓ Connects to 120+ data sources
✓ GDPR-compliant data processing

Start your free 14-day trial. No credit card required.`;

const TARGET_MARKETS = ["DACH", "Benelux", "Nordics", "UK", "France", "Wider EU", "US"];
const AD_PLATFORMS = ["Google Ads", "Meta Ads", "LinkedIn Ads", "Landing Page"];

const DIMENSIONS: {
  key: keyof Omit<ReviewResult, "totalScore" | "rewrittenCopy">;
  label: string;
  description: string;
}[] = [
  { key: "icpFit", label: "ICP / Persona Fit", description: "How well copy speaks to the target customer" },
  { key: "valueProp", label: "Value Proposition", description: "Feature → benefit clarity" },
  { key: "ctaStrength", label: "CTA Strength", description: "Call-to-action and funnel alignment" },
  { key: "euLocalization", label: "EU Localization & GDPR", description: "Tone, language, and consent compliance" },
];

function scoreColor(score: number, max = 25) {
  const pct = score / max;
  if (pct >= 0.8) return { bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800" };
  if (pct >= 0.6) return { bar: "bg-amber-400", badge: "bg-amber-100 text-amber-800" };
  return { bar: "bg-rose-500", badge: "bg-rose-100 text-rose-800" };
}

function totalScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-500";
  return "text-rose-600";
}

function DimensionCard({ dim, data }: { dim: typeof DIMENSIONS[0]; data: DimensionScore }) {
  const colors = scoreColor(data.score);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{dim.label}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{dim.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${colors.badge}`}>
          {data.score}/25
        </span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full transition-all ${colors.bar}`}
          style={{ width: `${(data.score / 25) * 100}%` }}
        />
      </div>

      <p className="text-sm text-gray-700 mb-3">{data.feedback}</p>

      <ul className="space-y-1.5">
        {data.issues.map((issue, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-600">
            <span className="mt-0.5 shrink-0 text-rose-400">▸</span>
            {issue}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Shared styles for text inputs and selects so they stay visually consistent
const inputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 transition";

export default function Home() {
  const [copy, setCopy] = useState("");
  const [context, setContext] = useState<ReviewContext>({
    icp: "",
    product: "",
    targetMarket: "",
    adPlatform: "",
  });
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setCtx(field: keyof ReviewContext, value: string) {
    setContext((prev) => ({ ...prev, [field]: value }));
  }

  async function handleReview() {
    if (!copy.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // context is sent alongside copy so the API can ground each scoring
        // dimension against the user's actual strategy
        body: JSON.stringify({ copy, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Campaign Copy Reviewer</h1>
            <p className="text-sm text-gray-500 mt-0.5">Score your marketing copy across 4 dimensions</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        {/* Input section */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-5">

          {/* Context inputs — ground each scoring dimension in the user's strategy */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Campaign context{" "}
              <span className="font-normal text-gray-400">(optional — improves scoring accuracy)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">

              {/* ICP / persona — used to ground icpFit scoring */}
              <div>
                <label htmlFor="ctx-icp" className="block text-xs font-medium text-gray-600 mb-1">
                  Target ICP / persona
                </label>
                <input
                  id="ctx-icp"
                  type="text"
                  value={context.icp}
                  onChange={(e) => setCtx("icp", e.target.value)}
                  placeholder="e.g. VP Marketing at Series B SaaS, 50–200 employees"
                  className={inputClass}
                />
              </div>

              {/* Product / category — used to ground valueProp scoring */}
              <div>
                <label htmlFor="ctx-product" className="block text-xs font-medium text-gray-600 mb-1">
                  Product / category
                </label>
                <input
                  id="ctx-product"
                  type="text"
                  value={context.product}
                  onChange={(e) => setCtx("product", e.target.value)}
                  placeholder="e.g. B2B analytics platform, marketing automation tool"
                  className={inputClass}
                />
              </div>

              {/* Target market — used to ground euLocalization scoring */}
              <div>
                <label htmlFor="ctx-market" className="block text-xs font-medium text-gray-600 mb-1">
                  Target market
                </label>
                <select
                  id="ctx-market"
                  value={context.targetMarket}
                  onChange={(e) => setCtx("targetMarket", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a market</option>
                  {TARGET_MARKETS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Ad platform — used to ground ctaStrength scoring */}
              <div>
                <label htmlFor="ctx-platform" className="block text-xs font-medium text-gray-600 mb-1">
                  Ad platform
                </label>
                <select
                  id="ctx-platform"
                  value={context.adPlatform}
                  onChange={(e) => setCtx("adPlatform", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a platform</option>
                  {AD_PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Copy textarea */}
          <div>
            <label htmlFor="copy-input" className="block text-sm font-semibold text-gray-700 mb-2">
              Paste your ad copy or landing page copy
            </label>
            <textarea
              id="copy-input"
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={10}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 placeholder-gray-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 resize-y transition"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">{copy.length.toLocaleString()} / 10 000 characters</span>
              <button
                onClick={handleReview}
                disabled={loading || !copy.trim() || copy.length > 10_000}
                className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Reviewing…
                  </span>
                ) : (
                  "Review Copy"
                )}
              </button>
            </div>
          </div>

        </section>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <section className="space-y-8">
            {/* Total score */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 flex items-center gap-6">
              <div className="text-center shrink-0">
                <span className={`text-6xl font-extrabold tabular-nums ${totalScoreColor(result.totalScore)}`}>
                  {result.totalScore}
                </span>
                <p className="text-sm text-gray-500 mt-1">out of 100</p>
              </div>
              <div className="flex-1">
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${scoreColor(result.totalScore, 100).bar}`}
                    style={{ width: `${result.totalScore}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {result.totalScore >= 80
                    ? "Strong copy — minor refinements recommended."
                    : result.totalScore >= 60
                    ? "Decent foundation with meaningful gaps to address."
                    : "Significant improvements needed before publishing."}
                </p>
              </div>
            </div>

            {/* Radar chart — four-axis spider view of the dimension scores */}
            <ScoreRadar result={result} />

            {/* Dimension cards */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
                Dimension Breakdown
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {DIMENSIONS.map((dim) => (
                  <DimensionCard key={dim.key} dim={dim} data={result[dim.key]} />
                ))}
              </div>
            </div>

            {/* Rewritten copy */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
                Suggested Rewrite
              </h2>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-5 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {result.rewrittenCopy}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(result.rewrittenCopy)}
                className="mt-3 rounded-md border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Copy to clipboard
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
