import type { Rating } from './types';

/**
 * Linear weighted kappa on categories 0..k-1, weights w_ij = 1 - |i-j|/(k-1).
 * kappa = (po - pe) / (1 - pe) where po, pe are weighted observed / expected agreement.
 * Choice: if 1 - pe == 0 (both raters used one single category, so chance agreement is
 * total) kappa is undefined and we return null. Empty input also returns null.
 */
export function linearWeightedKappa(pairs: [number, number][], k = 4): number | null {
  const n = pairs.length;
  if (n === 0) return null;
  const w = (i: number, j: number) => 1 - Math.abs(i - j) / (k - 1);
  const rowM = new Array<number>(k).fill(0);
  const colM = new Array<number>(k).fill(0);
  let po = 0;
  for (const [a, b] of pairs) {
    rowM[a]++;
    colM[b]++;
    po += w(a, b);
  }
  po /= n;
  let pe = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) pe += w(i, j) * (rowM[i] / n) * (colM[j] / n);
  if (1 - pe < 1e-12) return null;
  return (po - pe) / (1 - pe);
}

export interface SubdomainComparison {
  id: string;
  a: Rating['stage'] | undefined;
  b: Rating['stage'] | undefined;
  /** true/false when both are 0-3; null when either is unknown/na/unrated. */
  agree: boolean | null;
}
export interface RaterComparison {
  perSubdomain: SubdomainComparison[];
  /** Exact agreement over pairs where both are 0-3; null if no such pairs. */
  percentAgreement: number | null;
  kappa: number | null;
  nPairs: number;
  excluded: { unknownOrNa: number; ids: string[] };
}

export function compareRaters(
  ratingsA: Record<string, Rating | undefined>,
  ratingsB: Record<string, Rating | undefined>,
  subdomainIds: string[],
): RaterComparison {
  const perSubdomain: SubdomainComparison[] = [];
  const pairs: [number, number][] = [];
  const ids: string[] = [];
  for (const id of subdomainIds) {
    const a = ratingsA[id]?.stage;
    const b = ratingsB[id]?.stage;
    if (typeof a === 'number' && typeof b === 'number') {
      pairs.push([a, b]);
      perSubdomain.push({ id, a, b, agree: a === b });
    } else {
      ids.push(id);
      perSubdomain.push({ id, a, b, agree: null });
    }
  }
  const exact = pairs.filter(([a, b]) => a === b).length;
  return {
    perSubdomain,
    percentAgreement: pairs.length ? exact / pairs.length : null,
    kappa: linearWeightedKappa(pairs),
    nPairs: pairs.length,
    excluded: { unknownOrNa: ids.length, ids },
  };
}
