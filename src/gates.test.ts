import { describe, expect, it } from 'vitest';
import { evaluateGates } from './gates';
import type { Question, QuestionAnswer } from './types';

const qs: Question[] = [
  { id: 'q1', text: '', gate: { from: 0, to: 1 } },
  { id: 'q2', text: '', gate: { from: 2, to: 3 } },
  { id: 'q3', text: '', gate: { from: 1, to: 2 } },
  { id: 'q4', text: '', gate: null },
];
const a = (x: QuestionAnswer['answer']): QuestionAnswer => ({ answer: x });

describe('evaluateGates', () => {
  it('returns null suggestion when no gates', () => {
    const r = evaluateGates([{ id: 'x', text: '', gate: null }], {});
    expect(r.hasGates).toBe(false);
    expect(r.suggested).toBeNull();
  });
  it('suggests 0 when nothing is answered', () => {
    expect(evaluateGates(qs, {}).suggested).toBe(0);
  });
  it('climbs with passed gates', () => {
    expect(evaluateGates(qs, { q1: a('yes') }).suggested).toBe(1);
    expect(evaluateGates(qs, { q1: a('yes'), q3: a('yes') }).suggested).toBe(2);
    expect(evaluateGates(qs, { q1: a('yes'), q3: a('yes'), q2: a('yes') }).suggested).toBe(3);
  });
  it('a blocked lower gate caps the stage', () => {
    expect(evaluateGates(qs, { q1: a('no'), q3: a('yes'), q2: a('yes') }).suggested).toBe(0);
  });
  it('partly is partial and not counted as passed', () => {
    const r = evaluateGates(qs, { q1: a('partly') });
    expect(r.gates[0]!.status).toBe('partial');
    expect(r.suggested).toBe(0);
  });
  it('unknown blocks', () => {
    expect(evaluateGates(qs, { q1: a('unknown') }).gates[0]!.status).toBe('blocked');
  });
});
