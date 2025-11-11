export interface EvaluationCriterion {
  pass: boolean;
  reason: string;
}

export interface AttentionScore {
  score: "high" | "medium" | "low";
  reason: string;
}

export interface Evaluation {
  // Quality Score Criteria (6 criteria)
  complete: EvaluationCriterion;
  legible: EvaluationCriterion;
  consistent: EvaluationCriterion;
  compliant: EvaluationCriterion;
  justified: EvaluationCriterion;
  measurable: EvaluationCriterion;

  // Attention Score Criteria (2 criteria)
  relevant: AttentionScore;
  material: AttentionScore;

  // Computed Scores
  qualityScore: number;
  attentionScore: number;

  // Overall Result
  overallPass: boolean;
  summary: string;
}
