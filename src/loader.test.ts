import { describe, expect, it } from 'vitest';
import frameworkJson from '../data/framework.json';
import strategyJson from '../data/strategy-rules.json';
import estoniaJson from '../data/pilots/estonia.json';
import philippinesJson from '../data/pilots/philippines.json';
import { parseAssessment, parseFramework, parseStrategyRules } from './loader';

describe('loader', () => {
  const fw = parseFramework(frameworkJson);

  it('parses framework and strategy rules', () => {
    expect(fw.ok).toBe(true);
    if (fw.ok) expect(fw.value.domains.flatMap((d) => d.subdomains)).toHaveLength(49);
    expect(parseStrategyRules(strategyJson).ok).toBe(true);
  });

  it('parses both pilots against the framework without warnings', () => {
    if (!fw.ok) throw new Error('framework');
    for (const j of [estoniaJson, philippinesJson]) {
      const r = parseAssessment(j, fw.value);
      expect(r.ok).toBe(true);
      expect(r.warnings).toEqual([]);
    }
  });

  it('reports a broken rating by subdomain id', () => {
    const broken = structuredClone(estoniaJson) as unknown as { ratings: Record<string, unknown> };
    broken.ratings['3.4'] = { stage: 7, evidence: [] };
    const r = parseAssessment(broken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain('ratings.3.4: stage must be 0-3, unknown or na');
  });

  it('warns about rating ids not in the framework and never throws on junk', () => {
    if (!fw.ok) throw new Error('framework');
    const extra = structuredClone(estoniaJson) as unknown as { ratings: Record<string, unknown> };
    extra.ratings['9.9'] = { stage: 1, evidence: [] };
    const r = parseAssessment(extra, fw.value);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.startsWith('ratings.9.9'))).toBe(true);
    expect(parseAssessment(null).ok).toBe(false);
    expect(parseAssessment('x').ok).toBe(false);
    expect(parseFramework(42).ok).toBe(false);
  });
});
