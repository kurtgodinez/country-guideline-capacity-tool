import { useId, useState } from 'react';
import { domainScore, type Ratings } from '../scoring';
import type { Assessment, Framework, Rating, StageValue } from '../types';
import { HatchDefs, PATTERN_IDS } from './HatchDefs';
import { stageLabel } from './StageChip';
import styles from './ProfileStrata.module.css';

/** Shared grid geometry so that Profile, Compare and Report line up cell for cell. */
export const GEOM = { labelW: 236, cellW: 46, cellH: 40, rowGap: 8, pad: 4 } as const;

export function maxColumns(fw: Framework): number {
  return Math.max(1, ...fw.domains.map((d) => d.subdomains.length));
}
export function stripWidth(columns: number): number {
  return GEOM.labelW + columns * GEOM.cellW + GEOM.pad * 2;
}
export function rowY(i: number): number {
  return GEOM.pad + i * (GEOM.cellH + GEOM.rowGap);
}
export function stripHeight(rows: number): number {
  return GEOM.pad * 2 + rows * (GEOM.cellH + GEOM.rowGap) - GEOM.rowGap;
}

type Cell = StageValue | 'unrated';
export function cellValue(r: Rating | undefined): Cell {
  return r ? r.stage : 'unrated';
}
export function cellShortLabel(v: Cell): string {
  return v === 'unknown' ? '?' : v === 'na' ? '–' : v === 'unrated' ? '' : String(v);
}
export function cellPattern(v: Cell): string | null {
  if (v === 'unrated' || v === 'na') return null;
  return `url(#${v === 'unknown' ? PATTERN_IDS.unknown : PATTERN_IDS[`stage${v}` as 'stage0']})`;
}
const stageName = (v: Cell, fw: Framework): string => {
  if (typeof v === 'number') {
    const lv = fw.scale.levels.find((l) => l.value === v);
    return lv ? `stage ${v}, ${lv.label}` : `stage ${v}`;
  }
  return stageLabel(v).toLowerCase();
};

interface Props {
  assessment: Assessment;
  framework: Framework;
  /** Tooltips and keyboard focus. Default true; set false for print. */
  interactive?: boolean;
  /** Force the number of cell columns (use the same value for two strata that must align). */
  columns?: number;
  /** Optional per-subdomain mark drawn in the corner of a cell, e.g. { '1.2': 'Δ2' }. */
  marks?: Record<string, string>;
  hideLegend?: boolean;
  /** Renders pattern defs locally so the SVG works standalone (print, export). */
  standaloneDefs?: boolean;
}

export function ProfileStrata({ assessment, framework, interactive = true, columns, marks, hideLegend, standaloneDefs }: Props) {
  const cols = columns ?? maxColumns(framework);
  const W = stripWidth(cols);
  const H = stripHeight(framework.domains.length);
  const [tip, setTip] = useState<{ domain: number; col: number; sid: string } | null>(null);
  const uid = useId();
  const ratings = assessment.ratings as Ratings;

  let tipBox = null;
  if (interactive && tip) {
    const d = framework.domains[tip.domain];
    const s = d.subdomains[tip.col];
    const r = ratings[s.id];
    const v = cellValue(r);
    const ev = r?.evidence[0]?.text;
    const left = ((GEOM.pad + GEOM.labelW + tip.col * GEOM.cellW + GEOM.cellW / 2) / W) * 100;
    const top = ((rowY(tip.domain) + GEOM.cellH) / H) * 100;
    tipBox = (
      <div className={styles.tip} style={{ left: `${Math.min(Math.max(left, 18), 82)}%`, top: `${top}%` }} role="tooltip" id={`${uid}-tip`}>
        <div className={styles.tipTitle}>
          <span className={styles.mono}>{s.id}</span> {s.title}
        </div>
        <div>{stageName(v, framework)[0].toUpperCase() + stageName(v, framework).slice(1)}</div>
        {ev && <div className={styles.tipEv}>{ev}</div>}
        {r?.missing && <div className={styles.tipMissing}>Still missing: {r.missing}</div>}
      </div>
    );
  }

  return (
    <figure className={styles.figure}>
      <div className={styles.wrap}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxWidth: W, display: 'block' }}
          role="group"
          aria-label={`Profile strata for ${assessment.country}`}
          className={styles.svg}
        >
          {standaloneDefs && <HatchDefs />}
          {framework.domains.map((d, di) => {
            const ds = domainScore(framework, d, ratings);
            const y = rowY(di);
            const title = d.title.length > 26 ? `${d.title.slice(0, 25)}…` : d.title;
            const scoreText = ds.insufficient
              ? `insufficient evidence · coverage ${Math.round(ds.coverage * 100)}%`
              : `${Math.round(ds.score as number)}% · coverage ${Math.round(ds.coverage * 100)}%`;
            return (
              <g key={d.id}>
                <text x={GEOM.pad} y={y + 16} className={styles.domTitle}>
                  <tspan className={styles.domId}>{d.id}</tspan> {title}
                  <title>{`${d.id} ${d.title}`}</title>
                </text>
                <text x={GEOM.pad} y={y + 33} className={styles.domScore}>{scoreText}</text>
                {d.subdomains.map((s, ci) => {
                  const r = ratings[s.id];
                  const v = cellValue(r);
                  const x = GEOM.pad + GEOM.labelW + ci * GEOM.cellW;
                  const fill = cellPattern(v);
                  const w = GEOM.cellW - 4;
                  const h = GEOM.cellH;
                  const label = `${s.id} ${s.title}: ${stageName(v, framework)}`;
                  const short = cellShortLabel(v);
                  const mark = marks?.[s.id];
                  return (
                    <g
                      key={s.id}
                      role="img"
                      aria-label={label}
                      aria-describedby={interactive && tip?.sid === s.id ? `${uid}-tip` : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      className={styles.cell}
                      data-stage={String(v)}
                      data-subdomain={s.id}
                      onMouseEnter={interactive ? () => setTip({ domain: di, col: ci, sid: s.id }) : undefined}
                      onMouseLeave={interactive ? () => setTip(null) : undefined}
                      onFocus={interactive ? () => setTip({ domain: di, col: ci, sid: s.id }) : undefined}
                      onBlur={interactive ? () => setTip(null) : undefined}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx="3"
                        fill={fill ?? 'var(--surface)'}
                        stroke={v === 'unknown' ? 'var(--unknown-hatch)' : v === 'unrated' || v === 'na' ? 'var(--ink-muted)' : 'var(--ink-muted)'}
                        strokeWidth="1"
                        strokeDasharray={v === 'unrated' ? '3 3' : undefined}
                      />
                      {v === 3 && <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} rx="1.5" fill="none" stroke="var(--surface)" strokeWidth="1" />}
                      {v === 'na' && <line x1={x + 12} y1={y + h / 2} x2={x + w - 12} y2={y + h / 2} stroke="var(--ink)" strokeWidth="1.8" />}
                      {short && v !== 'na' && (
                        <>
                          <rect x={x + w / 2 - 9} y={y + h / 2 - 8} width="18" height="16" rx="3" fill="var(--surface)" />
                          <text x={x + w / 2} y={y + h / 2 + 4.5} textAnchor="middle" className={styles.cellLabel}>{short}</text>
                        </>
                      )}
                      {mark && (
                        <g>
                          <rect x={x + w - 22} y={y - 3} width="24" height="13" rx="2" fill="var(--surface)" stroke="var(--gap)" />
                          <text x={x + w - 10} y={y + 7} textAnchor="middle" className={styles.mark}>{mark}</text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
        {tipBox}
      </div>
      {!hideLegend && <Legend />}
    </figure>
  );
}

export function Legend() {
  const items: { v: Cell; text: string }[] = [
    { v: 0, text: 'Stage 0' },
    { v: 1, text: 'Stage 1' },
    { v: 2, text: 'Stage 2' },
    { v: 3, text: 'Stage 3' },
    { v: 'unknown', text: 'Unknown' },
    { v: 'na', text: 'Not applicable' },
    { v: 'unrated', text: 'Not yet rated' },
  ];
  return (
    <figcaption className={styles.legend}>
      <ul>
        {items.map((it) => (
          <li key={String(it.v)}>
            <svg width="22" height="16" aria-hidden="true">
              <rect x="0.5" y="0.5" width="21" height="15" rx="2" fill={cellPattern(it.v) ?? 'var(--surface)'} stroke="var(--ink-muted)" strokeDasharray={it.v === 'unrated' ? '3 2' : undefined} />
              {it.v === 3 && <rect x="3.5" y="3.5" width="15" height="9" fill="none" stroke="var(--surface)" />}
              {it.v === 'na' && <line x1="6" y1="8" x2="16" y2="8" stroke="var(--ink)" strokeWidth="1.6" />}
            </svg>
            {it.text}
          </li>
        ))}
      </ul>
    </figcaption>
  );
}
