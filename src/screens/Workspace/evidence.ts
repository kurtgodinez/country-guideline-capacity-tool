import type { Rating } from '../../types';

export const hasEvidence = (r: Rating | undefined): boolean => !!r && r.evidence.some((e) => e.text.trim() !== '');
export const isNumeric = (s: unknown): s is 0 | 1 | 2 | 3 => s === 0 || s === 1 || s === 2 || s === 3;
/** Rated 0-3 with no evidence entries. */
export const ratedWithoutEvidence = (r: Rating | undefined): boolean => !!r && isNumeric(r.stage) && !hasEvidence(r);
export const EVIDENCE_MESSAGE = 'Add at least one evidence entry first, or choose Unknown.';
