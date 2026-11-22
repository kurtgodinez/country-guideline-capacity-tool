import { useState } from 'react';
import { framework } from '../data';
import type { DomainScore, NationalScore } from '../scoring';
import { HowMadePanel } from './HowMadePanel';
import styles from './ScoreBadge.module.css';

type Props =
  | { kind: 'national'; result: NationalScore; compact?: boolean }
  | { kind: 'domain'; result: DomainScore; compact?: boolean };

const p = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x)}%`);
export const ASSESSMENT_TYPE_LABEL = { self: 'Self-assessed', external: 'Externally assessed' } as const;

/** A score is never shown alone: coverage, range, (national) weakest domain and assessment type always accompany it. Click opens the "how made" panel. */
export function ScoreBadge(props: Props) {
  const [open, setOpen] = useState(false);
  const r = props.result;
  const headline = r.insufficient ? 'Insufficient evidence' : p(r.score);
  const weakest =
    props.kind === 'national'
      ? props.result.weakestDomains.length
        ? props.result.weakestDomains.map((d) => `${d.id} ${d.title} (${p(d.score)})`).join('; ')
        : 'n/a'
      : null;
  return (
    <>
      <button
        type="button"
        className={`${styles.badge} ${props.compact ? styles.compact : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="How this number was made"
      >
        <span className={`${styles.score} ${r.insufficient ? styles.insufficient : ''}`}>{headline}</span>
        <span className={styles.meta}>Coverage {p(r.coverage * 100)}</span>
        <span className={styles.meta}>
          Range {p(r.low)}–{p(r.high)}
        </span>
        {props.kind === 'national' && (
          <>
            <span className={styles.meta}>Weakest: {weakest}</span>
            <span className={styles.meta}>{ASSESSMENT_TYPE_LABEL[props.result.assessmentType]}</span>
          </>
        )}
      </button>
      {open &&
        (props.kind === 'national' ? (
          <HowMadePanel framework={framework} kind="national" result={props.result} onClose={() => setOpen(false)} />
        ) : (
          <HowMadePanel framework={framework} kind="domain" result={props.result} onClose={() => setOpen(false)} />
        ))}
    </>
  );
}
