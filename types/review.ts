export interface DimensionScore {
  score: number;
  feedback: string;
  issues: [string, string, string];
}

export interface ReviewResult {
  totalScore: number;
  icpFit: DimensionScore;
  valueProp: DimensionScore;
  ctaStrength: DimensionScore;
  euLocalization: DimensionScore;
  rewrittenCopy: string;
}
