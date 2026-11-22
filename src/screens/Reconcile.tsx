import { useState } from 'react';
import { framework } from '../data';
import { importAssessmentJSON } from '../io';
import { parseAssessment } from '../loader';
import { compareRaters } from '../kappa';
import { useStore } from '../store';
import type { Assessment, Evidence, Rating, StageValue } from '../types';
import { Button, StageChip } from '../components';
import styles from './Reconcile.module.css';

const STAGE_OPTIONS: StageValue[] = [0, 1, 2, 3, 'unknown', 'na'];
const label = (s: StageValue | undefined) => (s === undefined ? 'not rated' : s === 'unknown' ? 'unknown' : s === 'na' ? 'n/a' : `stage ${s}`);

/** Parse a second rating set: a full Assessment or {name, ratings}. */
export function parseSecondSet(text: string): { ok: true; value: NonNullable<Assessment['secondAssessor']> } | { ok: false; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || typeof o.ratings !== 'object' || !o.ratings) return { ok: false, errors: ['Expected an assessment or {name, ratings}.'] };
  if (typeof o.name === 'string' && typeof o.country !== 'string') {
    const shell = { id: 'second', country: 'second', asOf: 'n/a', mode: 'desk', assessors: [], framework: framework.version, ratings: o.ratings };
    const r = parseAssessment(shell, framework);
    if (!r.ok) return { ok: false, errors: r.errors };
    return { ok: true, value: { name: o.name, ratings: r.value.ratings } };
  }
  const r = importAssessmentJSON(text, framework);
  if (!r.ok) return { ok: false, errors: r.errors };
  const a = r.value;
  return { ok: true, value: { name: a.assessors.join(', ') || `${a.country} ${a.asOf}`, ratings: a.ratings } };
}

function mergeEvidence(a: Evidence[], b: Evidence[]): Evidence[] {
  const key = (e: Evidence) => `${e.text}|${e.source ?? ''}|${e.page ?? ''}`;
  const seen = new Set(a.map(key));
  return [...a, ...b.filter((e) => !seen.has(key(e)))];
}

export function Reconcile({ assessmentId }: { assessmentId: string }) {
  const a = useStore((s) => s.assessments[assessmentId]);
  const setSecond = useStore((s) => s.setSecondAssessor);
  const setRating = useStore((s) => s.setRating);
  const [kept, setKept] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [consensus, setConsensus] = useState<Record<string, { stage: string; note: string; err?: string }>>({});
  if (!a) return null;
  const second = a.secondAssessor;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const r = parseSecondSet(await f.text());
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setSecond(a.id, r.value);
  };

  const subs = framework.domains.flatMap((d) => d.subdomains);
  const cmp = second ? compareRaters(a.ratings, second.ratings, subs.map((s) => s.id)) : null;
  const diff = (x: StageValue | undefined, y: StageValue | undefined) =>
    typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) : null;

  const acceptSecond = (id: string) => {
    const lead = a.ratings[id];
    const sec = second!.ratings[id];
    if (!sec) return;
    setRating(a.id, id, { ...sec, evidence: mergeEvidence(lead?.evidence ?? [], sec.evidence ?? []) });
  };
  const acceptConsensus = (id: string) => {
    const c = consensus[id];
    if (!c || c.stage === '' || !c.note.trim()) return setConsensus({ ...consensus, [id]: { stage: c?.stage ?? '', note: c?.note ?? '', err: 'Choose a stage and write a note.' } });
    const stage: StageValue = c.stage === 'unknown' || c.stage === 'na' ? c.stage : (Number(c.stage) as 0 | 1 | 2 | 3);
    const lead = a.ratings[id];
    const patch: Partial<Rating> = { stage, note: [lead?.note, `Consensus: ${c.note.trim()}`].filter(Boolean).join(' ') };
    setRating(a.id, id, patch);
    setConsensus({ ...consensus, [id]: { stage: '', note: '' } });
  };

  return (
    <section aria-labelledby="rec-title" className={styles.page}>
      <h1 id="rec-title">Reconcile: {a.country}</h1>
      <div>
        <label>
          Import second rating set (JSON: an assessment, or {'{name, ratings}'}){' '}
          <input type="file" accept="application/json,.json" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        {errors.length > 0 && (
          <ul role="alert" className={styles.err}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
      </div>

      {!second || !cmp ? (
        <p className={styles.muted}>No second rating set imported yet.</p>
      ) : (
        <>
          <div className={styles.summary} aria-label="Agreement summary">
            <div>Second assessor: <strong>{second.name}</strong> <Button variant="link" onClick={() => setSecond(a.id, undefined)}>Remove</Button></div>
            <div>
              Percent agreement: <strong>{cmp.percentAgreement === null ? 'undefined' : `${Math.round(cmp.percentAgreement * 100)}%`}</strong>
            </div>
            <div>
              Linear weighted kappa:{' '}
              <strong>{cmp.kappa === null ? 'undefined' : cmp.kappa.toFixed(2)}</strong>
              {cmp.kappa === null && (
                <span className={styles.muted}>
                  {' '}({cmp.nPairs === 0 ? 'no pairs rated 0-3 by both assessors' : 'chance agreement is total, as both assessors used a single stage'})
                </span>
              )}
            </div>
            <div>Pairs compared: <strong>{cmp.nPairs}</strong></div>
            <div>
              Excluded pairs (unknown, n/a or not rated by either): <strong>{cmp.excluded.unknownOrNa}</strong>
              <span className={styles.muted}>
                {' '}(unknown: {cmp.perSubdomain.filter((p) => p.agree === null && (p.a === 'unknown' || p.b === 'unknown')).length}; n/a:{' '}
                {cmp.perSubdomain.filter((p) => p.agree === null && p.a !== 'unknown' && p.b !== 'unknown' && (p.a === 'na' || p.b === 'na')).length})
              </span>
            </div>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Subdomain</th>
                <th scope="col">Lead</th>
                <th scope="col">Second</th>
                <th scope="col">Agreement</th>
                <th scope="col">Resolve</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => {
                const l = a.ratings[s.id]?.stage;
                const sc = second.ratings[s.id]?.stage;
                const d = diff(l, sc);
                const differs = l !== sc;
                const c = consensus[s.id] ?? { stage: '', note: '' };
                return (
                  <tr key={s.id} className={differs ? styles.differ : undefined} data-subdomain={s.id}>
                    <th scope="row"><span className={styles.mono}>{s.id}</span> {s.title}</th>
                    <td><StageChip value={l ?? 'unrated'} showText /></td>
                    <td><StageChip value={sc ?? 'unrated'} showText /></td>
                    <td>{!differs ? 'agree' : d !== null ? `differ (|diff| ${d})` : 'differ'}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button onClick={() => setKept({ ...kept, [s.id]: true })} disabled={!differs} aria-label={`Accept lead rating for ${s.id}`}>Accept lead</Button>
                        {kept[s.id] && differs && <span className={styles.muted}>lead kept ({label(l)})</span>}
                        <Button onClick={() => acceptSecond(s.id)} disabled={!second.ratings[s.id] || !differs} aria-label={`Accept second rating for ${s.id}`}>Accept second</Button>
                      </div>
                      <div className={styles.consensus}>
                        <select aria-label={`Consensus stage for ${s.id}`} value={c.stage} onChange={(e) => setConsensus({ ...consensus, [s.id]: { ...c, stage: e.target.value } })}>
                          <option value="">Consensus stage…</option>
                          {STAGE_OPTIONS.map((o) => <option key={String(o)} value={String(o)}>{label(o)}</option>)}
                        </select>
                        <input aria-label={`Consensus note for ${s.id}`} placeholder="Required note" value={c.note} onChange={(e) => setConsensus({ ...consensus, [s.id]: { ...c, note: e.target.value } })} />
                        <Button onClick={() => acceptConsensus(s.id)} aria-label={`Set consensus for ${s.id}`}>Set consensus</Button>
                        {c.err && <span className={styles.err}>{c.err}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className={styles.muted}>Accept lead: the lead rating is kept as it is. Accepting the second rating or a consensus writes to the lead assessment.</p>
        </>
      )}
    </section>
  );
}
