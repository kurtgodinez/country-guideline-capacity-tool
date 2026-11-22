import { describe, expect, it } from 'vitest';
import frameworkJson from '../data/framework.json';
import strategyJson from '../data/strategy-rules.json';
import estoniaJson from '../data/pilots/estonia.json';
import philippinesJson from '../data/pilots/philippines.json';
import { parseAssessment, parseFramework, parseStrategyRules } from './loader';
import { ANCHOR_UNDEFINED, applyStrategy, evaluateExpression, ExpressionError, parseExpression } from './strategy';
import type { Assessment, Rating, StageValue } from './types';

const fwR = parseFramework(frameworkJson);
const rulesR = parseStrategyRules(strategyJson);
if (!fwR.ok || !rulesR.ok) throw new Error('fixtures');
const fw = fwR.value;
const rules = rulesR.value;

const ctx = (m: Record<string, number | null>, s: Record<string, number | null> = {}) => ({
  median: (g: string) => m[g],
  stage: (id: string) => s[id] ?? null,
});
const ev = (src: string, m: Record<string, number | null> = {}, s: Record<string, number | null> = {}) =>
  evaluateExpression(parseExpression(src), ctx(m, s));

describe('expression parser', () => {
  it('AND binds tighter than OR', () => {
    expect(ev('1 >= 2 AND 1 >= 2 OR 3 >= 3')).toBe(true); // (F AND F) OR T
    expect(ev('3 >= 3 OR 1 >= 2 AND 1 >= 2')).toBe(true); // T OR (F AND F)
    expect(ev('1 >= 2 AND (1 >= 2 OR 3 >= 3)')).toBe(false);
  });
  it('supports all operators and parentheses', () => {
    expect(ev('2 > 1 AND 1 < 2 AND 2 <= 2 AND 2 == 2')).toBe(true);
    expect(ev('median(g) >= 2', { g: 1.5 })).toBe(false);
    expect(ev("(stage('5.3') >= 2)", {}, { '5.3': 2 })).toBe(true);
  });
  it('null comparisons are false', () => {
    expect(ev("stage('5.3') >= 0")).toBe(false);
    expect(ev('median(g) <= 3', { g: null })).toBe(false);
  });
  it('otherwise', () => {
    expect(parseExpression('otherwise')).toEqual({ t: 'otherwise' });
    expect(() => parseExpression('otherwise AND 1 > 0')).toThrow(ExpressionError);
  });
  it('throws clear errors', () => {
    expect(() => parseExpression('')).toThrow(/Empty/);
    expect(() => parseExpression('median(g) >=')).toThrow(/Expected a value/);
    expect(() => parseExpression('median(g) >= 2 AND')).toThrow(ExpressionError);
    expect(() => parseExpression('(median(g) >= 2')).toThrow(/Expected '\)'/);
    expect(() => parseExpression('median(g) >= 2 2')).toThrow(/Unexpected token/);
    expect(() => parseExpression('median(g) = 2')).toThrow(/'=='/);
    expect(() => parseExpression('2')).toThrow(/comparison operator/);
    expect(() => parseExpression('foo(g) > 1')).toThrow(ExpressionError);
    expect(() => parseExpression('1 > 0 $')).toThrow(/Unexpected character/);
    expect(() => parseExpression("stage('5.3 >= 2")).toThrow(/Unterminated/);
  });
});

function synth(stages: Record<string, StageValue>): Assessment {
  const ratings: Record<string, Rating> = {};
  for (const s of fw.domains.flatMap((d) => d.subdomains)) ratings[s.id] = { stage: 1, evidence: [] };
  for (const [id, stage] of Object.entries(stages)) ratings[id] = { stage, evidence: [] };
  return { id: 't', country: 'T', asOf: '2026-01-01', mode: 'desk', assessors: [], framework: fw.version, ratings };
}
const produce = ['2.1', '4.1', '4.2', '4.5', '5.3'];
const adapt = ['5.1', '5.2', '5.4', '5.5', '6.1'];
const set = (ids: string[], v: StageValue) => Object.fromEntries(ids.map((i) => [i, v]));

describe('applyStrategy', () => {
  it('fires R1', () => {
    const r = applyStrategy(rules, fw, synth(set(produce, 2)));
    expect(r.fired?.id).toBe('R1');
    expect(r.medians.produce.median).toBe(2);
    expect(r.status).toBe(rules.status);
  });
  it('fires R2 when produce is low but adapt >= 1', () => {
    const r = applyStrategy(rules, fw, synth({ ...set(produce, 0), ...set(adapt, 2) }));
    expect(r.fired?.id).toBe('R2');
  });
  it('R1 needs stage 5.3 >= 2 too', () => {
    const r = applyStrategy(rules, fw, synth({ ...set(produce, 2), '5.3': 1 }));
    expect(r.fired?.id).toBe('R2');
  });
  it('fires R3 otherwise', () => {
    const r = applyStrategy(rules, fw, synth({ ...set(produce, 0), ...set(adapt, 0) }));
    expect(r.fired?.id).toBe('R3');
    expect(r.blocking.map((b) => b.id)).toEqual(expect.arrayContaining(['2.1', '5.1']));
    expect(r.blocking[0].title).toBeTruthy();
  });
  it('insufficient evidence: no rule fires, no fall-through to R3', () => {
    const r = applyStrategy(rules, fw, synth({ ...set(['2.1', '4.1', '4.2'], 'unknown'), ...set(adapt, 0) }));
    expect(r.medians.produce.insufficient).toBe(true);
    expect(r.insufficientEvidence).toBe(true);
    expect(r.fired).toBeNull();
    expect(r.insufficientGroups).toEqual(['produce']);
    expect(r.blocking.map((b) => b.id)).toContain('2.1');
  });
  it('exactly half unknown is not insufficient; na is excluded but not counted as unknown', () => {
    const r = applyStrategy(rules, fw, synth({ '2.1': 'unknown', '4.1': 'unknown', '4.2': 'na', '4.5': 3, '5.3': 3 }));
    expect(r.medians.produce.insufficient).toBe(false);
    expect(r.medians.produce.median).toBe(3);
    expect(r.medians.produce.excluded).toEqual(['2.1', '4.1', '4.2']);
  });
  it('unrated counts as unknown', () => {
    const a = synth(set(produce, 2));
    for (const id of ['2.1', '4.1', '4.2']) delete a.ratings[id];
    const r = applyStrategy(rules, fw, a);
    expect(r.insufficientEvidence).toBe(true);
    expect(r.medians.produce.unrated).toEqual(['2.1', '4.1', '4.2']);
  });
  it('next steps: three lowest, ties in framework order, anchor of next stage', () => {
    const a = synth({});
    for (const id of Object.keys(a.ratings)) a.ratings[id].stage = 3;
    a.ratings['1.1'].stage = 1;
    a.ratings['1.2'].stage = 0;
    a.ratings['2.1'].stage = 0;
    a.ratings['2.2'].stage = 2;
    const r = applyStrategy(rules, fw, a);
    expect(r.nextSteps.map((n) => [n.id, n.stage, n.nextStage])).toEqual([
      ['1.2', 0, 1],
      ['2.1', 0, 1],
      ['1.1', 1, 2],
    ]);
    const sub = fw.domains.flatMap((d) => d.subdomains).find((s) => s.id === '1.2')!;
    expect(r.nextSteps[0].anchorText).toBe(sub.anchors ? sub.anchors['1'] || ANCHOR_UNDEFINED : ANCHOR_UNDEFINED);
  });
  it('anchor not yet defined when framework has no anchors', () => {
    const fw2 = structuredClone(fw);
    for (const d of fw2.domains) for (const s of d.subdomains) s.anchors = null;
    const r = applyStrategy(rules, fw2, synth({ '1.1': 0 }));
    expect(r.nextSteps[0].anchorText).toBe(ANCHOR_UNDEFINED);
  });

  it('pilots', () => {
    const out: Record<string, string | null> = {};
    for (const [name, j] of [['estonia', estoniaJson], ['philippines', philippinesJson]] as const) {
      const p = parseAssessment(j, fw);
      if (!p.ok) throw new Error(name);
      const r = applyStrategy(rules, fw, p.value);
      out[name] = r.insufficientEvidence ? 'insufficient' : (r.fired?.id ?? null);
      expect(r.nextSteps).toHaveLength(3);
    }
    expect(out).toEqual({ estonia: 'R2', philippines: 'R2' });
  });
});
