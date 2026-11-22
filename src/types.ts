export type StageValue = 0 | 1 | 2 | 3 | 'unknown' | 'na';
export type NumericStage = 0 | 1 | 2 | 3;

export interface Evidence {
  text: string;
  source?: string;
  page?: string;
  url?: string;
  quote?: string;
}
export interface QuestionAnswer {
  answer: 'yes' | 'partly' | 'no' | 'unknown';
  note?: string;
}
export interface Rating {
  stage: StageValue;
  evidence: Evidence[];
  note?: string;
  missing?: string;
  answers?: Record<string, QuestionAnswer>;
  assessor?: string;
  updatedAt?: string;
  /** Required by the UI when the assessor overrides the stage suggested by the gates. */
  stageOverrideReason?: string;
}
export interface AssessmentSource {
  id?: string;
  title: string;
  url?: string;
  note?: string;
}
export interface Assessment {
  id: string;
  country: string;
  asOf: string;
  mode: 'desk' | 'full';
  /** 'self' when absent. */
  assessedBy?: 'self' | 'external';
  assessedByNote?: string;
  assessors: string[];
  framework: string;
  summary?: string;
  sources?: AssessmentSource[];
  ratings: Record<string, Rating>;
  secondAssessor?: { name: string; ratings: Record<string, Rating> };
}

// ---- Framework (data/framework.json) ----
export interface Gate {
  from: number;
  to: number;
}
export interface Question {
  id: string;
  text: string;
  gate: Gate | null;
}
export type Anchors = Record<'0' | '1' | '2' | '3', string>;
export interface Subdomain {
  id: string;
  title: string;
  definition: string;
  questions: Question[];
  anchors: Anchors | null;
}
export interface Domain {
  id: string;
  title: string;
  definition: string;
  subdomains: Subdomain[];
}
export interface ScaleLevel {
  value: number;
  label: string;
  description: string;
  look?: string;
}
export interface ScaleSpecial {
  value: 'unknown' | 'na';
  label: string;
  description: string;
}
export interface Scoring {
  subdomain?: string;
  domain?: string;
  national?: string;
  /** Domain id -> weight. null/absent means equal weights. */
  weights?: Record<string, number> | null;
  minCoverage?: number;
  unknown?: string;
  na?: string;
  status?: string;
}
export interface Framework {
  id: string;
  version: string;
  status: string;
  question?: string;
  principle?: string;
  scale: { source?: string; levels: ScaleLevel[]; special: ScaleSpecial[] };
  domains: Domain[];
  scoring?: Scoring;
  /** Legacy/alternative locations for weights and minCoverage. */
  weights?: Record<string, number> | null;
  minCoverage?: number;
}

// ---- Strategy rules (data/strategy-rules.json) ----
export interface StrategyRule {
  id: string;
  when: string;
  result: string;
  label: string;
}
export interface StrategyRules {
  status: string;
  purpose?: string;
  unknownHandling?: string;
  groups: Record<string, { label: string; subdomains: string[] }>;
  rules: StrategyRule[];
  alwaysShow?: string[];
}
