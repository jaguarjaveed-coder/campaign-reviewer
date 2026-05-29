"use client";

// This component is loaded via next/dynamic with ssr:false in page.tsx because
// recharts internally reads window/document during render. Keeping it in its
// own file makes the dynamic import boundary clean and explicit.

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ReviewResult } from "@/types/review";

interface Props {
  result: ReviewResult;
}

// Short axis labels — long strings clip on small viewports.
const CHART_DATA = (result: ReviewResult) => [
  { axis: "ICP Fit",      score: result.icpFit.score },
  { axis: "Value Prop",   score: result.valueProp.score },
  { axis: "CTA Strength", score: result.ctaStrength.score },
  { axis: "EU / GDPR",    score: result.euLocalization.score },
];

// Custom tooltip so hovering a vertex shows "ICP Fit: 18 / 25"
function RadarTooltip({ active, payload }: { active?: boolean; payload?: { payload: { axis: string; score: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { axis, score } = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <span className="font-semibold text-gray-800">{axis}</span>
      <span className="ml-2 text-violet-600 font-bold">{score} / 25</span>
    </div>
  );
}

export default function ScoreRadar({ result }: Props) {
  const data = CHART_DATA(result);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">
        Score Overview
      </h2>
      <p className="text-xs text-gray-400 mb-4">Each axis 0 – 25</p>

      {/* ResponsiveContainer makes the chart fill its parent width on any screen size */}
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          {/* Concentric grid rings at 5-point intervals */}
          <PolarGrid
            stroke="#e5e7eb"
            strokeDasharray="3 3"
          />

          {/* Axis labels around the perimeter */}
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fontSize: 12, fill: "#6b7280", fontWeight: 500 }}
          />

          {/* Radius scale 0–25; labels hidden — the grid rings supply the scale context */}
          <PolarRadiusAxis
            domain={[0, 25]}
            tickCount={6}
            tick={false}
            axisLine={false}
          />

          {/* The filled polygon — violet to match the rest of the UI */}
          <Radar
            dataKey="score"
            stroke="#7c3aed"
            strokeWidth={2}
            fill="#7c3aed"
            fillOpacity={0.15}
            dot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#7c3aed", stroke: "#fff", strokeWidth: 2 }}
          />

          <Tooltip content={<RadarTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
