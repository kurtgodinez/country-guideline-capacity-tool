import { describe, expect, it } from 'vitest';
import frameworkJson from '../data/framework.json';
import estoniaJson from '../data/pilots/estonia.json';
import philippinesJson from '../data/pilots/philippines.json';
import { parseAssessment, parseFramework } from './loader';
import { counts, domainScore, flatSubdomainMean, nationalScore, subdomainScore } from './scoring';
import type { Assessment, Framework, StageValue } from './types';

const fwR = parseFramework(frameworkJson);
const estR = parseAssessment(estoniaJson);
const phR = parseAssessment(philippinesJson);
if (!fwR.ok || !estR.ok || !phR.ok) throw new Error('data files failed to load');
const fw = fwR.value;
const estonia = estR.value;
const philippines = phR.value;
const pct = (x: number | null) => Math.round(x as number);

describe('pilot counts', () => {
  it('Estonia', () => {
    expect(counts(fw, estonia.ratings)).toEqual({ 0: 3, 1: 26, 2: 10, 3: 0, unknown: 9, na: 1, unrated: 0 });
  });
  it('Philippines', () => {
    expect(counts(fw, philippines.ratings)).toEqual({ 0: 0, 1: 16, 2: 20, 3: 4, unknown: 9, na: 0, unrated: 0 });
  });
});

describe('flat reference (all subdomains averaged directly)', () => {
  it('Estonia 39% (32-51), coverage 81%', () => {
    const f = flatSubdomainMean(fw, estonia.ratings);
    expect([pct(f.score), pct(f.low), pct(f.high), pct(f.coverage * 100)]).toEqual([39, 32, 51, 81]);
  });
  it('Philippines 57% (46-65), coverage 82%', () => {
    const f = flatSubdomainMean(fw, philippines.ratings);
    expect([pct(f.score), pct(f.low), pct(f.high), pct(f.coverage * 100)]).toEqual([57, 46, 65, 82]);
  });
});

describe('domain-first national score', () => {
  it('Estonia 40%, weakest domain 3 Priority setting at 25%', () => {
    const n = nationalScore(fw, estonia);
    expect(pct(n.score)).toBe(40);
    expect(n.weakestDomains.map((d) => d.id)).toEqual(['3']);
    expect(n.weakestDomains[0].title).toBe('Priority setting');
    expect(pct(n.weakestDomains[0].score)).toBe(25);
    expect(pct(n.coverage * 100)).toBe(81);
    expect([pct(n.low), pct(n.high)]).toEqual([32, 52]);
    expect(n.assessmentType).toBe('external');
    expect(n.equalWeights).toBe(true);
    expect(n.insufficient).toBe(false);
  });
  it('Philippines 55%, weakest tied 2, 4, 8 at 44%', () => {
    const n = nationalScore(fw, philippines);
    expect(pct(n.score)).toBe(55);
    expect(n.weakestDomains.map((d) => d.id)).toEqual(['2', '4', '8']);
    expect(n.weakestDomains.map((d) => pct(d.score))).toEqual([44, 44, 44]);
    expect(pct(n.coverage * 100)).toBe(82);
    expect([pct(n.low), pct(n.high)]).toEqual([45, 64]);
    expect(n.assessmentType).toBe('self');
  });
  it('differs from the flat mean because domains have different numbers of rated subdomains', () => {
    // Flat mean gives every rated subdomain the same say, so domains with more rated
    // subdomains weigh more. Domain-first gives each domain one vote.
    // Estonia: flat 39.3 vs domain-first 39.8 (both "39/40" after rounding differently);
    // Philippines: flat 56.7 vs domain-first 54.6, a 2-point gap.
    const e = [flatSubdomainMean(fw, estonia.ratings).score as number, nationalScore(fw, estonia).score as number];
    const p = [
      flatSubdomainMean(fw, philippines.ratings).score as number,
      nationalScore(fw, philippines).score as number,
    ];
    expect(e[1] - e[0]).toBeGreaterThan(0.4);
    expect(p[0] - p[1]).toBeGreaterThan(2);
  });
  it('exposes what the "How this number was made" panel needs', () => {
    const n = nationalScore(fw, estonia);
    expect(n.unknownIds).toHaveLength(9);
    expect(n.naIds).toHaveLength(1);
    expect(n.domains).toHaveLength(9);
    expect(n.domains[0].includedIds.length).toBe(n.domains[0].rated);
    expect(n.formula).toMatch(/weighted mean of domain scores \(equal weights\)/);
  });
});

// ---- Hand-worked tiny framework ----
function tinyFw(extra: Partial<Framework> = {}): Framework {
  const sub = (id: string) => ({ id, title: `S${id}`, definition: '', questions: [], anchors: null });
  return {
    id: 't',
    version: 't1',
    status: 'test',
    scale: { levels: [], special: [] },
    domains: [
      { id: 'A', title: 'Alpha', definition: '', subdomains: ['A1', 'A2', 'A3', 'A4'].map(sub) },
      { id: 'B', title: 'Beta', definition: '', subdomains: ['B1', 'B2'].map(sub) },
    ],
    ...extra,
  };
}
function asm(stages: Record<string, StageValue>, assessedBy?: 'self' | 'external'): Assessment {
  return {
    id: 'x', country: 'X', asOf: '2026', mode: 'desk', assessors: [], framework: 't1',
    ...(assessedBy ? { assessedBy } : {}),
    ratings: Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, { stage: v, evidence: [] }])),
  };
}

describe('hand-worked tiny framework', () => {
  it('subdomain formula', () => {
    const v = [0, 1, 2, 3].map((s) => subdomainScore(s as 0 | 1 | 2 | 3));
    expect(v[0]).toBe(0);
    expect(v[1]).toBeCloseTo(33.333, 2);
    expect(v[2]).toBeCloseTo(66.667, 2);
    expect(v[3]).toBe(100);
  });

  it('domain mean excludes unknown and na; unknowns drive the range', () => {
    // A: 3, 1, unknown, na -> rated {A1,A2}: (100 + 33.33)/2 = 66.67; applicable 3; coverage 2/3
    // low: unknown=0 -> (100+33.33+0)/3 = 44.44 ; high: unknown=3 -> (100+33.33+100)/3 = 77.78
    const a = asm({ A1: 3, A2: 1, A3: 'unknown', A4: 'na', B1: 2, B2: 2 });
    const d = domainScore(tinyFw(), tinyFw().domains[0], a.ratings);
    expect(d.score).toBeCloseTo(66.667, 2);
    expect(d.applicable).toBe(3);
    expect(d.rated).toBe(2);
    expect(d.coverage).toBeCloseTo(2 / 3, 6);
    expect(d.low).toBeCloseTo(44.444, 2);
    expect(d.high).toBeCloseTo(77.778, 2);
    expect(d.unknownIds).toEqual(['A3']);
    expect(d.naIds).toEqual(['A4']);
    expect(d.includedIds).toEqual(['A1', 'A2']);
    expect(d.insufficient).toBe(false); // 0.667 >= 0.6
    // National, equal weights: B = 66.67 -> (66.67+66.67)/2
    const n = nationalScore(tinyFw(), a);
    expect(n.score).toBeCloseTo(66.667, 2);
    expect(n.coverage).toBeCloseTo(4 / 5, 6); // rated 4 of applicable 5
    expect(n.assessmentType).toBe('self');
  });

  it('missing ratings are not rated: excluded from mean, still applicable', () => {
    const a = asm({ A1: 3 });
    const d = domainScore(tinyFw(), tinyFw().domains[0], a.ratings);
    expect(d.score).toBe(100);
    expect(d.applicable).toBe(4);
    expect(d.coverage).toBe(0.25);
    expect(d.unratedIds).toEqual(['A2', 'A3', 'A4']);
    expect(d.insufficient).toBe(true);
  });

  it('insufficient evidence below minCoverage (default 0.6; framework.scoring overrides)', () => {
    const a = asm({ A1: 3, A2: 'unknown', A3: 'unknown', A4: 'unknown', B1: 1, B2: 1 });
    const n = nationalScore(tinyFw(), a);
    expect(n.domains[0].coverage).toBe(0.25);
    expect(n.domains[0].insufficient).toBe(true);
    expect(n.domains[1].insufficient).toBe(false);
    expect(n.coverage).toBeCloseTo(3 / 6, 6);
    expect(n.insufficient).toBe(true);
    const lax = nationalScore(tinyFw({ scoring: { minCoverage: 0.5 } }), a);
    expect(lax.insufficient).toBe(false);
    expect(lax.minCoverage).toBe(0.5);
  });

  it('unequal weights: weights come from framework.scoring.weights, domains with null score are dropped', () => {
    // A = 100 (all 3s), B = 0 (all 0s). Weights A:3, B:1 -> (300 + 0)/4 = 75
    const a = asm({ A1: 3, A2: 3, A3: 3, A4: 3, B1: 0, B2: 0 });
    const w = tinyFw({ scoring: { weights: { A: 3, B: 1 } } });
    const n = nationalScore(w, a);
    expect(n.score).toBe(75);
    expect(n.equalWeights).toBe(false);
    expect(n.weights).toEqual({ A: 3, B: 1 });
    expect(n.formula).toContain('weights A:3, B:1');
    expect(nationalScore(tinyFw(), a).score).toBe(50);
    // B not rated at all: B excluded, A carries the national score
    const onlyA = nationalScore(w, asm({ A1: 3, A2: 3, A3: 3, A4: 3 }));
    expect(onlyA.score).toBe(100);
    expect(onlyA.droppedDomainIds).toEqual(['B']);
  });

  it('weakest domains list every tie at the lowest rounded score; assessedBy flows through', () => {
    const a = asm({ A1: 1, A2: 1, A3: 1, A4: 1, B1: 1, B2: 1 }, 'external');
    const n = nationalScore(tinyFw(), a);
    expect(n.weakestDomains.map((d) => d.id)).toEqual(['A', 'B']);
    expect(n.assessmentType).toBe('external');
  });
});
