import { describe, expect, it } from 'vitest';
import frameworkJson from '../data/framework.json';
import estoniaJson from '../data/pilots/estonia.json';
import philippinesJson from '../data/pilots/philippines.json';
import { exportAssessmentJSON, exportCSV, importAssessmentJSON } from './io';
import { parseAssessment, parseFramework } from './loader';
import type { Assessment } from './types';

const fwR = parseFramework(frameworkJson);
if (!fwR.ok) throw new Error('fw');
const fw = fwR.value;
const meta = { frameworkStatus: 'DRAFT fw', strategyStatus: 'PLACEHOLDER rules' };

function load(j: unknown): Assessment {
  const r = parseAssessment(j, fw);
  if (!r.ok) throw new Error('pilot');
  return r.value;
}

describe('JSON round trip', () => {
  for (const [name, j] of [['estonia', estoniaJson], ['philippines', philippinesJson]] as const)
    it(`${name} export -> import deep-equals`, () => {
      const a = load(j);
      const text = exportAssessmentJSON(a, meta);
      const parsed = JSON.parse(text);
      expect(parsed._meta.frameworkStatus).toBe(meta.frameworkStatus);
      expect(parsed._meta.strategyStatus).toBe(meta.strategyStatus);
      expect(typeof parsed._meta.exportedAt).toBe('string');
      const back = importAssessmentJSON(text, fw);
      expect(back.ok).toBe(true);
      if (back.ok) expect(back.value).toEqual(a);
    });

  it('keeps answers, secondAssessor and full evidence', () => {
    const a = load(estoniaJson);
    a.ratings['1.1'] = {
      stage: 2,
      evidence: [{ text: 't', source: 's', page: '12', url: 'https://x.org', quote: 'q' }],
      note: 'n',
      missing: 'm',
      answers: { '1.1.q1': { answer: 'partly', note: 'hm' } },
      assessor: 'A',
      updatedAt: '2026-01-01T00:00:00Z',
      stageOverrideReason: 'because',
    };
    a.secondAssessor = { name: 'B', ratings: { '1.1': { stage: 'unknown', evidence: [] } } };
    a.assessedBy = 'external';
    a.assessedByNote = 'x';
    const back = importAssessmentJSON(exportAssessmentJSON(a, meta), fw);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.value).toEqual(a);
  });

  it('reports invalid JSON', () => {
    expect(importAssessmentJSON('{nope', fw).ok).toBe(false);
  });
});

describe('CSV', () => {
  it('has status comments, header, one row per subdomain and escapes properly', () => {
    const a = load(estoniaJson);
    a.ratings['1.1'] = {
      stage: 1,
      evidence: [
        { text: 'has "quotes", commas', source: 'Doc A', page: '3' },
        { text: 'second' },
      ],
      note: 'line1\nline2',
      missing: 'm',
    };
    const csv = exportCSV(fw, a, meta);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('DRAFT fw');
    expect(lines[1]).toContain('PLACEHOLDER rules');
    expect(csv).toContain('domain_id,domain_title,subdomain_id,subdomain_title,stage,evidence,note,missing');
    expect(csv).toContain('"has ""quotes"", commas (Doc A, p. 3) | second"');
    expect(csv).toContain('"line1\nline2"');
    const nSub = fw.domains.reduce((n, d) => n + d.subdomains.length, 0);
    expect((csv.match(/^\d+,/gm) ?? []).length).toBe(nSub);
  });
});
