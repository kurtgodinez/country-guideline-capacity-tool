import type { Assessment, Domain, Framework, Rating } from './types';

export const DEFAULT_MIN_COVERAGE = 0.6;

export type Ratings = Record<string, Rating | undefined>;

export function subdomainScore(stage: 0 | 1 | 2 | 3): number {
  return (stage / 3) * 100;
}

export function minCoverageOf(fw: Framework): number {
  return fw.scoring?.minCoverage ?? fw.minCoverage ?? DEFAULT_MIN_COVERAGE;
}

/** Domain id -> weight, or null when equal. */
export function weightsOf(fw: Framework): Record<string, number> | null {
  return fw.scoring?.weights ?? fw.weights ?? null;
}

export function weightFor(fw: Framework, domainId: string): number {
  const w = weightsOf(fw);
  if (!w) return 1;
  return w[domainId] ?? 0;
}

export function areWeightsEqual(fw: Framework): boolean {
  const ids = fw.domains.map((d) => weightFor(fw, d.id));
  return ids.every((x) => x === ids[0]);
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export interface DomainScore {
  id: string;
  title: string;
  /** Mean of rated subdomain scores, 0-100; null when nothing is rated. */
  score: number | null;
  /** rated / applicable (0 when applicable is 0). */
  coverage: number;
  rated: number;
  applicable: number;
  unratedCount: number;
  unknownIds: string[];
  naIds: string[];
  unratedIds: string[];
  includedIds: string[];
  /** Score with every unknown at stage 0 / stage 3 (null when nothing is left to average). */
  low: number | null;
  high: number | null;
  insufficient: boolean;
  minCoverage: number;
  formula: string;
}

export interface NationalScore {
  /** Weighted mean of domain scores (null domains excluded). */
  score: number | null;
  coverage: number;
  rated: number;
  applicable: number;
  low: number | null;
  high: number | null;
  insufficient: boolean;
  minCoverage: number;
  /** Every domain tied at the lowest score (compared rounded to 0.1). */
  weakestDomains: { id: string; title: string; score: number }[];
  assessmentType: 'self' | 'external';
  /** Domain id -> weight actually used (raw, before normalising). */
  weights: Record<string, number>;
  equalWeights: boolean;
  domains: DomainScore[];
  includedDomainIds: string[];
  droppedDomainIds: string[];
  unknownIds: string[];
  naIds: string[];
  unratedIds: string[];
  formula: string;
}

export interface FlatScore {
  score: number | null;
  coverage: number;
  rated: number;
  applicable: number;
  low: number | null;
  high: number | null;
  unknownIds: string[];
  naIds: string[];
  unratedIds: string[];
  includedIds: string[];
  insufficient: boolean;
  formula: string;
}

export interface Counts {
  0: number;
  1: number;
  2: number;
  3: number;
  unknown: number;
  na: number;
  unrated: number;
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

interface Classified {
  includedIds: string[];
  scores: number[];
  unknownIds: string[];
  naIds: string[];
  unratedIds: string[];
}

function classify(ids: string[], ratings: Ratings): Classified {
  const c: Classified = { includedIds: [], scores: [], unknownIds: [], naIds: [], unratedIds: [] };
  for (const id of ids) {
    const r = ratings[id];
    if (!r) c.unratedIds.push(id);
    else if (r.stage === 'unknown') c.unknownIds.push(id);
    else if (r.stage === 'na') c.naIds.push(id);
    else {
      c.includedIds.push(id);
      c.scores.push(subdomainScore(r.stage));
    }
  }
  return c;
}

function bounds(c: Classified): { low: number | null; high: number | null } {
  const u = c.unknownIds.length;
  return {
    low: mean([...c.scores, ...Array<number>(u).fill(0)]),
    high: mean([...c.scores, ...Array<number>(u).fill(100)]),
  };
}

const pct = (x: number | null): string => (x === null ? 'n/a' : `${Math.round(x)}%`);

export function domainScore(fw: Framework, domain: Domain, ratings: Ratings): DomainScore {
  const c = classify(
    domain.subdomains.map((s) => s.id),
    ratings,
  );
  const applicable = domain.subdomains.length - c.naIds.length;
  const rated = c.includedIds.length;
  const coverage = applicable > 0 ? rated / applicable : 0;
  const minCoverage = minCoverageOf(fw);
  const { low, high } = bounds(c);
  return {
    id: domain.id,
    title: domain.title,
    score: mean(c.scores),
    coverage,
    rated,
    applicable,
    unratedCount: c.unratedIds.length,
    unknownIds: c.unknownIds,
    naIds: c.naIds,
    unratedIds: c.unratedIds,
    includedIds: c.includedIds,
    low,
    high,
    insufficient: coverage < minCoverage,
    minCoverage,
    formula: `Domain ${domain.id} = mean of (stage / 3 x 100) over ${rated} rated subdomain(s)${
      c.includedIds.length ? ` [${c.includedIds.join(', ')}]` : ''
    }; unknown and n/a dropped. Coverage = ${rated} / ${applicable}.`,
  };
}

function allIds(fw: Framework): string[] {
  return fw.domains.flatMap((d) => d.subdomains.map((s) => s.id));
}

export function nationalScore(fw: Framework, assessment: Assessment): NationalScore {
  const ratings = assessment.ratings as Ratings;
  const domains = fw.domains.map((d) => domainScore(fw, d, ratings));
  const minCoverage = minCoverageOf(fw);
  const equalWeights = areWeightsEqual(fw);
  const weights: Record<string, number> = {};
  for (const d of fw.domains) weights[d.id] = weightFor(fw, d.id);

  const wmean = (pick: (d: DomainScore) => number | null): number | null => {
    let num = 0;
    let den = 0;
    for (const d of domains) {
      const v = pick(d);
      if (v === null) continue;
      num += v * weights[d.id];
      den += weights[d.id];
    }
    return den > 0 ? num / den : null;
  };

  const score = wmean((d) => d.score);
  const low = wmean((d) => d.low);
  const high = wmean((d) => d.high);
  const rated = domains.reduce((a, d) => a + d.rated, 0);
  const applicable = domains.reduce((a, d) => a + d.applicable, 0);
  const coverage = applicable > 0 ? rated / applicable : 0;

  const withScore = domains.filter((d) => d.score !== null);
  let weakest: NationalScore['weakestDomains'] = [];
  if (withScore.length) {
    const minR = Math.min(...withScore.map((d) => round1(d.score as number)));
    weakest = withScore
      .filter((d) => round1(d.score as number) === minR)
      .map((d) => ({ id: d.id, title: d.title, score: d.score as number }));
  }

  const included = withScore.filter((d) => weights[d.id] > 0).map((d) => d.id);
  const dropped = domains.filter((d) => !included.includes(d.id)).map((d) => d.id);
  const wText = equalWeights
    ? 'equal weights'
    : `weights ${fw.domains.map((d) => `${d.id}:${weights[d.id]}`).join(', ')}`;

  return {
    score,
    coverage,
    rated,
    applicable,
    low,
    high,
    insufficient: coverage < minCoverage,
    minCoverage,
    weakestDomains: weakest,
    assessmentType: assessment.assessedBy ?? 'self',
    weights,
    equalWeights,
    domains,
    includedDomainIds: included,
    droppedDomainIds: dropped,
    unknownIds: domains.flatMap((d) => d.unknownIds),
    naIds: domains.flatMap((d) => d.naIds),
    unratedIds: domains.flatMap((d) => d.unratedIds),
    formula:
      `National = weighted mean of domain scores (${wText}); domain = mean of rated subdomain scores (stage / 3 x 100); ` +
      `unknown and n/a dropped; domains with no rated subdomain excluded. ` +
      `Coverage = rated / applicable = ${rated} / ${applicable} (${pct(coverage * 100)}). ` +
      `Range = same score with unknowns at 0 (${pct(low)}) and at 3 (${pct(high)}).`,
  };
}

/** Reference comparison: all subdomains averaged directly, with no domain step. */
export function flatSubdomainMean(fw: Framework, ratings: Ratings): FlatScore {
  const c = classify(allIds(fw), ratings);
  const applicable = allIds(fw).length - c.naIds.length;
  const rated = c.includedIds.length;
  const coverage = applicable > 0 ? rated / applicable : 0;
  const { low, high } = bounds(c);
  return {
    score: mean(c.scores),
    coverage,
    rated,
    applicable,
    low,
    high,
    unknownIds: c.unknownIds,
    naIds: c.naIds,
    unratedIds: c.unratedIds,
    includedIds: c.includedIds,
    insufficient: coverage < minCoverageOf(fw),
    formula: `Flat mean of (stage / 3 x 100) over all ${rated} rated subdomains, no domain step. Coverage = ${rated} / ${applicable}.`,
  };
}

export function counts(fw: Framework, ratings: Ratings): Counts {
  const out: Counts = { 0: 0, 1: 0, 2: 0, 3: 0, unknown: 0, na: 0, unrated: 0 };
  for (const id of allIds(fw)) {
    const r = ratings[id];
    if (!r) out.unrated++;
    else out[r.stage]++;
  }
  return out;
}
