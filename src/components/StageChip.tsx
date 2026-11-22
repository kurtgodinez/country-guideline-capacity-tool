import type { StageValue } from '../types';
import { PATTERN_IDS } from './HatchDefs';
import styles from './StageChip.module.css';

export type ChipValue = StageValue | 'unrated';

export function stageLabel(v: ChipValue): string {
  if (v === 'unknown') return 'Unknown';
  if (v === 'na') return 'Not applicable';
  if (v === 'unrated') return 'Not yet rated';
  return `Stage ${v}`;
}

interface Props {
  value: ChipValue;
  /** Show the text label beside the swatch. */
  showText?: boolean;
  size?: number;
}

/** Stage swatch: colour + pattern, never colour alone. Needs <HatchDefs /> in the document. */
export function StageChip({ value, showText = false, size = 20 }: Props) {
  const label = stageLabel(value);
  const s = size;
  let body;
  if (value === 'unrated') {
    body = <circle cx={s / 2} cy={s / 2} r={s / 2 - 2} fill="none" stroke="var(--ink-muted)" strokeWidth="1.5" />;
  } else if (value === 'na') {
    body = (
      <>
        <rect x="0.5" y="0.5" width={s - 1} height={s - 1} rx="3" fill="var(--surface)" stroke="var(--rule)" />
        <line x1={s * 0.25} y1={s / 2} x2={s * 0.75} y2={s / 2} stroke="var(--ink)" strokeWidth="1.8" />
      </>
    );
  } else {
    const id = value === 'unknown' ? PATTERN_IDS.unknown : PATTERN_IDS[`stage${value}` as 'stage0'];
    body = (
      <>
        <rect x="0.5" y="0.5" width={s - 1} height={s - 1} rx="3" fill={`url(#${id})`} stroke={value === 'unknown' ? 'var(--unknown-hatch)' : 'var(--ink-muted)'} strokeWidth="1" />
        {value === 3 && <rect x="3.5" y="3.5" width={s - 7} height={s - 7} rx="1" fill="none" stroke="var(--surface)" strokeWidth="1" />}
      </>
    );
  }
  return (
    <span className={styles.chip} data-stage={String(value)}>
      <svg role="img" aria-label={label} width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        {body}
      </svg>
      {showText && <span className={styles.text}>{label}</span>}
    </span>
  );
}
