import { describe, expect, it } from 'vitest';
import { compareRaters, linearWeightedKappa } from './kappa';
import type { Rating } from './types';

describe('linearWeightedKappa', () => {
  it('matches a hand-worked example', () => {
    // pairs: (0,0) (1,1) (2,2) (3,3) (1,2) (2,1), n = 6, k = 4, weights 1, 2/3, 1/3, 0 for |d| = 0..3.
    // Observed disagreement Do = mean(|i-j|/3) = (2 * 1/3) / 6 = 1/9.
    // Marginals (both raters): counts [1,2,2,1] over 6.
    // Sum over ordered (i,j) of |i-j| * c_i * c_j:
    //   |d|=1: (0,1)=2 (1,2)=4 (2,3)=2 -> 8, x2 ordered = 16, x1 = 16
    //   |d|=2: (0,2)=2 (1,3)=2 -> 4, x2 = 8, x2 = 16
    //   |d|=3: (0,3)=1 -> x2 = 2, x3 = 6      total 38
    // Expected disagreement De = 38 / 36 / 3 = 19/54.
    // kappa = 1 - Do/De = 1 - (6/54)/(19/54) = 13/19.
    const k = linearWeightedKappa([[0, 0], [1, 1], [2, 2], [3, 3], [1, 2], [2, 1]]);
    expect(k).toBeCloseTo(13 / 19, 10);
  });

  it('is 1 for perfect agreement with varied categories', () => {
    expect(linearWeightedKappa([[0, 0], [1, 1], [2, 2], [3, 3], [2, 2]])).toBeCloseTo(1, 10);
  });

  it('returns null when both raters use a single category (chance agreement = 1)', () => {
    expect(linearWeightedKappa([[2, 2], [2, 2], [2, 2]])).toBeNull();
    expect(linearWeightedKappa([])).toBeNull();
  });
});

const r = (stage: Rating['stage']): Rating => ({ stage, evidence: [] });

describe('compareRaters', () => {
  it('excludes unknown/na/unrated pairs and reports agreement', () => {
    const A = { a: r(0), b: r(1), c: r('unknown'), d: r(3), e: r(2) };
    const B = { a: r(0), b: r(2), c: r(1), d: r('na'), f: r(1) };
    const res = compareRaters(A, B, ['a', 'b', 'c', 'd', 'e']);
    expect(res.nPairs).toBe(2);
    expect(res.percentAgreement).toBe(0.5);
    expect(res.excluded).toEqual({ unknownOrNa: 3, ids: ['c', 'd', 'e'] });
    expect(res.perSubdomain.map((p) => p.agree)).toEqual([true, false, null, null, null]);
    expect(res.kappa).not.toBeNull();
  });
});
