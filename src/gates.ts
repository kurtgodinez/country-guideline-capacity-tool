import type { QuestionAnswer, Question } from './types';

export type GateStatus = 'passed' | 'partial' | 'blocked';
export interface GateResult {
  questionId: string;
  from: number;
  to: number;
  status: GateStatus;
}
export interface GateEvaluation {
  gates: GateResult[];
  hasGates: boolean;
  /** Highest stage s such that every gate with to <= s is passed; null when no question has a gate. */
  suggested: 0 | 1 | 2 | 3 | null;
}

/** "yes" passes, "partly" half-passes (not counted as passed for the suggestion), anything else blocks. */
export function gateStatus(a: QuestionAnswer | undefined): GateStatus {
  if (a?.answer === 'yes') return 'passed';
  if (a?.answer === 'partly') return 'partial';
  return 'blocked';
}

export function evaluateGates(questions: Question[], answers: Record<string, QuestionAnswer> | undefined): GateEvaluation {
  const gates: GateResult[] = [];
  for (const q of questions) {
    if (!q.gate) continue;
    gates.push({ questionId: q.id, from: q.gate.from, to: q.gate.to, status: gateStatus(answers?.[q.id]) });
  }
  if (!gates.length) return { gates, hasGates: false, suggested: null };
  let suggested: 0 | 1 | 2 | 3 = 0;
  for (const s of [3, 2, 1, 0] as const) {
    if (gates.filter((g) => g.to <= s).every((g) => g.status === 'passed')) {
      suggested = s;
      break;
    }
  }
  return { gates, hasGates: true, suggested };
}
