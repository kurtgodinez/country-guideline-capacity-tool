import { useEffect, useMemo, useRef } from 'react';
import { framework, pilots } from '../data';
import { nationalScore } from '../scoring';
import { paths } from '../router';
import { useStore } from '../store';
import type { Assessment, StageValue } from '../types';
import { DraftBanner, GEOM, maxColumns, ProfileStrata, rowY, ScoreBadge, StrataLegend, stripHeight, stripWidth } from '../components';
import styles from './Compare.module.css';

export type DiffMark = { kind: 'delta'; text: string } | { kind: 'unknown'; text: '?≠' };

export function diffMark(a: StageValue | undefined, b: StageValue | undefined): DiffMark | null {
  if (a === undefined || b === undefined || a === 'na' || b === 'na') return null;
  if (a === 'unknown' && b === 'unknown') return null;
  if (a === 'unknown' || b === 'unknown') return { kind: 'unknown', text: '?≠' };
  const d = Math.abs(a - b);
  return d >= 2 ? { kind: 'delta', text: `Δ${d}` } : null;
}

export function computeDiffs(x: Assessment, y: Assessment) {
  const marks: Record<string, DiffMark> = {};
  let compared = 0;
  for (const d of framework.domains)
    for (const s of d.subdomains) {
      compared++;
      const m = diffMark(x.ratings[s.id]?.stage, y.ratings[s.id]?.stage);
      if (m) marks[s.id] = m;
    }
  const list = Object.values(marks);
  return { marks, compared, delta: list.filter((m) => m.kind === 'delta').length, unknown: list.filter((m) => m.kind === 'unknown').length };
}

export function Compare() {
  const assessments = useStore((s) => s.assessments);
  const ready = useStore((s) => s.ready);
  const compareIds = useStore((s) => s.compareIds);
  const setCompareIds = useStore((s) => s.setCompareIds);
  const loadPilot = useStore((s) => s.loadPilot);
  const initialised = useRef(false);

  useEffect(() => {
    if (!ready || initialised.current) return;
    initialised.current = true;
    const valid = compareIds.filter((id) => assessments[id]);
    if (valid.length >= 2) return;
    const find = (country: string): string | null => {
      const hit = Object.values(assessments).find((a) => a.country.toLowerCase() === country.toLowerCase());
      if (hit) return hit.id;
      const p = pilots.find((x) => x.raw.country.toLowerCase() === country.toLowerCase());
      return p ? loadPilot(p.id) : null;
    };
    const ids = [find('Estonia'), find('Philippines')].filter((x): x is string => !!x);
    if (ids.length) setCompareIds(ids);
  }, [ready, compareIds, assessments, loadPilot, setCompareIds]);

  const list = Object.values(assessments).sort((a, b) => a.country.localeCompare(b.country));
  const [idA, idB] = [compareIds[0], compareIds[1]];
  const A = idA ? assessments[idA] : undefined;
  const B = idB ? assessments[idB] : undefined;
  const diffs = useMemo(() => (A && B ? computeDiffs(A, B) : null), [A, B]);

  const pick = (slot: 0 | 1, id: string) => {
    const next = [compareIds[0] ?? '', compareIds[1] ?? ''];
    next[slot] = id;
    setCompareIds(next.filter(Boolean));
  };
  const label = (a: Assessment) => `${a.country} (${a.asOf})`;

  return (
    <section aria-labelledby="compare-title" className={styles.page}>
      <h1 id="compare-title" className={styles.title}>Compare</h1>
      <DraftBanner statusText={framework.status} label="Framework status" />
      <div className={styles.pickers}>
        {([0, 1] as const).map((slot) => (
          <label key={slot}>
            {slot === 0 ? 'First assessment' : 'Second assessment'}
            <select value={compareIds[slot] && assessments[compareIds[slot]] ? compareIds[slot] : ''} onChange={(e) => pick(slot, e.target.value)}>
              <option value="" disabled>Choose…</option>
              {list.map((a) => (
                <option key={a.id} value={a.id}>{label(a)}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {(!A || !B) && <p className={styles.muted}>{list.length < 2 ? 'Save or load two assessments to compare them.' : 'Choose two assessments.'}</p>}
      {A && B && diffs && (
        <>
          <p className={styles.summary} aria-live="polite">
            {diffs.delta} cell{diffs.delta === 1 ? '' : 's'} differ by 2 or more stages; {diffs.unknown} cell{diffs.unknown === 1 ? '' : 's'} known in one assessment and unknown in the other; {diffs.compared} subdomains compared.
          </p>
          <div className={styles.legendMarks}>
            <span><b className={styles.chip}>Δ2</b> <b className={styles.chip}>Δ3</b> stage differs by 2 or 3</span>
            <span><b className={styles.chip}>?≠</b> one side unknown, the other rated</span>
          </div>
          <StrataBlock a={A} marks={diffs.marks} />
          <h2>Difference</h2>
          <DiffStrip a={A} b={B} marks={diffs.marks} />
          <StrataBlock a={B} marks={diffs.marks} />
          <StrataLegend />
        </>
      )}
    </section>
  );
}

function StrataBlock({ a, marks }: { a: Assessment; marks: Record<string, DiffMark> }) {
  const nat = nationalScore(framework, a);
  const m = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v.text]));
  return (
    <div className={styles.block}>
      <h2 className={styles.country}>
        {a.country} <span className={styles.asOf}>as of {a.asOf}</span>
      </h2>
      <ScoreBadge kind="national" result={nat} compact />
      <div className={styles.strata}>
        <ProfileStrata assessment={a} framework={framework} columns={maxColumns(framework)} marks={m} hideLegend />
      </div>
      <a href={paths.assessment(a.id, 'profile')} className={styles.link}>Open profile</a>
    </div>
  );
}

function DiffStrip({ a, b, marks }: { a: Assessment; b: Assessment; marks: Record<string, DiffMark> }) {
  const cols = maxColumns(framework);
  const W = stripWidth(cols);
  const H = stripHeight(framework.domains.length);
  return (
    <div className={styles.strata}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block' }} role="group" aria-label={`Differences between ${a.country} and ${b.country}`}>
        {framework.domains.map((d, di) => {
          const y = rowY(di);
          const n = d.subdomains.filter((s) => marks[s.id]).length;
          return (
            <g key={d.id}>
              <text x={GEOM.pad} y={y + 24} className={styles.diffLabel}>{d.id} {d.title.length > 26 ? `${d.title.slice(0, 25)}…` : d.title}: {n} flagged</text>
              {d.subdomains.map((s, ci) => {
                const x = GEOM.pad + GEOM.labelW + ci * GEOM.cellW;
                const m = marks[s.id];
                return (
                  <g key={s.id} role="img" aria-label={m ? `${s.id} ${s.title}: ${m.kind === 'delta' ? `stage difference ${m.text.slice(1)}` : 'known in one assessment, unknown in the other'}` : `${s.id} ${s.title}: no flagged difference`} tabIndex={0} className={styles.diffCell}>
                    <rect x={x} y={y + 8} width={GEOM.cellW - 4} height={GEOM.cellH - 16} rx="3" fill="var(--surface)" stroke={m ? 'var(--gap)' : 'var(--rule)'} strokeWidth={m ? 2 : 1} />
                    {m && <text x={x + (GEOM.cellW - 4) / 2} y={y + 24} textAnchor="middle" className={styles.diffMark}>{m.text}</text>}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
