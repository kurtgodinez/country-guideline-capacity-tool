import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScoreBadge, StageChip, Button, type ChipValue } from '../../components';
import { PATTERN_IDS } from '../../components/HatchDefs';
import { framework } from '../../data';
import { evaluateGates } from '../../gates';
import { paths } from '../../router';
import { counts, domainScore, nationalScore, type Ratings } from '../../scoring';
import { useStore } from '../../store';
import type { Domain, NumericStage, QuestionAnswer, Rating, StageValue, Subdomain } from '../../types';
import { EvidenceLedger } from './EvidenceLedger';
import { EVIDENCE_MESSAGE, hasEvidence, isNumeric, ratedWithoutEvidence } from './evidence';
import styles from './Workspace.module.css';

const ANSWERS: { v: QuestionAnswer['answer']; label: string }[] = [
  { v: 'yes', label: 'Yes' },
  { v: 'partly', label: 'Partly' },
  { v: 'no', label: 'No' },
  { v: 'unknown', label: 'Unknown' },
];
const GATE_TEXT = { passed: 'passed', partial: 'partly passed', blocked: 'not passed' } as const;

function readQuerySubdomain(): string | null {
  const m = /[?&]s=([^&]+)/.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]!) : null;
}

export function Workspace({ assessmentId }: { assessmentId: string }) {
  const assessment = useStore((s) => s.assessments[assessmentId]);
  const setRating = useStore((s) => s.setRating);

  const flat = useMemo(() => framework.domains.flatMap((d) => d.subdomains.map((s) => ({ d, s }))), []);
  const [selId, setSelId] = useState<string>(() => {
    const q = readQuerySubdomain();
    return q && flat.some((x) => x.s.id === q) ? q : (flat[0]?.s.id ?? '');
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{ stage: NumericStage; reason: string } | null>(null);

  const select = useCallback(
    (id: string) => {
      setSelId(id);
      setMessage(null);
      setPending(null);
      try {
        window.history.replaceState(null, '', `${paths.assessment(assessmentId, 'workspace')}?s=${encodeURIComponent(id)}`);
      } catch {
        /* ignore */
      }
    },
    [assessmentId],
  );

  const cur = flat.find((x) => x.s.id === selId);
  const rating: Rating | undefined = assessment?.ratings[selId];

  const gateEval = useMemo(() => (cur ? evaluateGates(cur.s.questions, rating?.answers) : null), [cur, rating?.answers]);
  const suggested = gateEval?.suggested ?? null;

  const save = useCallback(
    (partial: Partial<Rating>) => {
      if (cur) setRating(assessmentId, cur.s.id, partial);
    },
    [assessmentId, cur, setRating],
  );

  const requestStage = useCallback(
    (v: StageValue) => {
      if (!cur) return;
      setMessage(null);
      if (!isNumeric(v)) {
        setPending(null);
        save({ stage: v, stageOverrideReason: undefined });
        return;
      }
      if (!hasEvidence(rating)) {
        setPending(null);
        setMessage(EVIDENCE_MESSAGE);
        return;
      }
      if (suggested !== null && v !== suggested) {
        setPending({ stage: v, reason: rating?.stage === v ? (rating.stageOverrideReason ?? '') : '' });
        return;
      }
      setPending(null);
      save({ stage: v, stageOverrideReason: undefined });
    },
    [cur, rating, suggested, save],
  );

  // Keyboard shortcuts.
  const kb = useRef({ requestStage, select, selId, flat });
  kb.current = { requestStage, select, selId, flat };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const { requestStage: rs, select: sel, selId: id, flat: fl } = kb.current;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const i = fl.findIndex((x) => x.s.id === id);
        const n = fl[i + (e.key === 'ArrowDown' ? 1 : -1)];
        if (n) sel(n.s.id);
        e.preventDefault();
      } else if (e.key === '0' || e.key === '1' || e.key === '2' || e.key === '3') {
        e.preventDefault();
        rs(Number(e.key) as NumericStage);
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        rs('unknown');
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        rs('na');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!assessment || !cur) return <p>Nothing to show.</p>;
  const ratings = assessment.ratings as Ratings;
  const sub: Subdomain = cur.s;
  const dom: Domain = cur.d;
  const stageValue = rating?.stage;

  const setAnswer = (qid: string, patch: Partial<QuestionAnswer>) => {
    const prev = rating?.answers?.[qid];
    save({ answers: { ...(rating?.answers ?? {}), [qid]: { answer: prev?.answer ?? 'unknown', ...prev, ...patch } } });
  };

  const domCounts = counts({ ...framework, domains: [dom] }, ratings);
  const allCounts = counts(framework, ratings);
  const domSc = domainScore(framework, dom, ratings);
  const nat = nationalScore(framework, assessment);
  const noEvidence = flat.filter((x) => ratedWithoutEvidence(ratings[x.s.id]));

  const levels = framework.scale.levels;

  return (
    <div className={styles.root}>
      <h1 className={styles.visuallyHidden}>Assessment workspace: {assessment.country}</h1>
      <nav className={styles.tree} aria-label="Subdomains">
        {framework.domains.map((d) => (
          <div key={d.id} className={styles.domain}>
            <h2 className={styles.domainTitle}>
              <span className={styles.mono}>{d.id}</span> {d.title}
            </h2>
            <ul className={styles.subList}>
              {d.subdomains.map((s) => {
                const r = ratings[s.id];
                const active = s.id === selId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`${styles.subBtn} ${active ? styles.active : ''}`}
                      aria-current={active ? 'true' : undefined}
                      onClick={() => select(s.id)}
                    >
                      <span className={styles.mono}>{s.id}</span>
                      <span className={styles.subTitle}>{s.title}</span>
                      <StageChip value={(r ? r.stage : 'unrated') as ChipValue} size={16} />
                      {ratedWithoutEvidence(r) && <span className={styles.dot} role="img" aria-label="Rated without evidence" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <section className={styles.centre} aria-labelledby="sub-title">
        <p className={styles.hint}>
          Keys (outside text fields): <kbd>↑</kbd>/<kbd>↓</kbd> move between subdomains, <kbd>0</kbd>–<kbd>3</kbd> set stage,{' '}
          <kbd>U</kbd> unknown, <kbd>N</kbd> not applicable.
        </p>
        <h2 id="sub-title" className={styles.title}>
          <span className={styles.mono}>{sub.id}</span> {sub.title}
        </h2>
        <p className={styles.def}>{sub.definition}</p>

        <section className={styles.block} aria-labelledby="q-h">
          <h3 id="q-h" className={styles.h3}>Guiding questions</h3>
          {sub.questions.length === 0 && <p className={styles.muted}>No guiding questions.</p>}
          {sub.questions.map((q) => {
            const a = rating?.answers?.[q.id];
            return (
              <fieldset key={q.id} className={styles.question}>
                <legend className={styles.qText}>
                  <span className={styles.mono}>{q.id}</span> {q.text}
                </legend>
                <p className={styles.gateLine}>{q.gate ? `Gate: ${q.gate.from} → ${q.gate.to}` : 'Gate not yet assigned'}</p>
                <div className={styles.answers} role="radiogroup" aria-label={`Answer to ${q.id}`}>
                  {ANSWERS.map((o) => (
                    <label key={o.v} className={styles.radio}>
                      <input
                        type="radio"
                        name={`ans-${q.id}`}
                        value={o.v}
                        checked={a?.answer === o.v}
                        onChange={() => setAnswer(q.id, { answer: o.v })}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  className={styles.input}
                  aria-label={`Note for ${q.id}`}
                  placeholder="Note"
                  value={a?.note ?? ''}
                  onChange={(e) => setAnswer(q.id, { note: e.target.value })}
                />
              </fieldset>
            );
          })}
        </section>

        <section className={styles.block} aria-labelledby="stage-h">
          <h3 id="stage-h" className={styles.h3}>Stage</h3>
          <p className={styles.rule}>A document that says something exists scores nothing on its own</p>
          <div className={styles.stageWrap}>
            <div className={styles.stages} role="radiogroup" aria-labelledby="stage-h">
              {levels.map((lv) => {
                const n = lv.value as NumericStage;
                const anchor = sub.anchors?.[String(n) as '0'];
                const checked = stageValue === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    className={`${styles.step} ${checked ? styles.stepOn : ''}`}
                    onClick={() => requestStage(n)}
                  >
                    <span className={styles.stepHead}>
                      <StageChip value={n} size={18} /> <strong>{n}</strong> {lv.label}
                    </span>
                    {anchor ? (
                      <span className={styles.anchor}>{anchor}</span>
                    ) : (
                      <span className={styles.anchor}>
                        {lv.description} <span className={styles.tag}>Anchor not yet defined</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className={styles.special} role="radiogroup" aria-label="Unknown or not applicable">
              {(['unknown', 'na'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={stageValue === v}
                  className={`${styles.step} ${stageValue === v ? styles.stepOn : ''}`}
                  onClick={() => requestStage(v)}
                >
                  <StageChip value={v} size={18} /> {v === 'unknown' ? 'Unknown' : 'N/A'}
                </button>
              ))}
            </div>
            {message && (
              <p className={styles.warn} role="alert">
                {message}
              </p>
            )}
            {pending && (
              <form
                className={styles.override}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!pending.reason.trim()) return;
                  save({ stage: pending.stage, stageOverrideReason: pending.reason.trim() });
                  setPending(null);
                }}
              >
                <label>
                  Reason for choosing stage {pending.stage} instead of the suggested stage {suggested}
                  <input
                    type="text"
                    className={styles.input}
                    value={pending.reason}
                    onChange={(e) => setPending({ ...pending, reason: e.target.value })}
                    autoFocus
                  />
                </label>
                <div className={styles.evActions}>
                  <Button type="submit" variant="primary" disabled={!pending.reason.trim()}>Save stage {pending.stage}</Button>
                  <Button onClick={() => setPending(null)}>Cancel</Button>
                </div>
              </form>
            )}
            {isNumeric(stageValue) && rating?.stageOverrideReason && (
              <p className={styles.muted}>Override reason: {rating.stageOverrideReason}</p>
            )}
            {gateEval?.hasGates && (
              <aside className={styles.gates} aria-label="Gates">
                <h4 className={styles.h4}>Gates from your answers</h4>
                <ul>
                  {gateEval.gates.map((g) => (
                    <li key={g.questionId}>
                      <span className={styles.mono}>{g.from} → {g.to}</span> {GATE_TEXT[g.status]}
                      <span className={styles.muted}> ({g.questionId}){g.status === 'partial' ? ' - partial, not counted' : ''}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  Suggested stage: <strong>{suggested}</strong>
                </p>
              </aside>
            )}
          </div>
        </section>

        <EvidenceLedger entries={rating?.evidence ?? []} onChange={(evidence) => save({ evidence })} />

        <section className={styles.block}>
          <label className={styles.field}>
            Still missing
            <textarea rows={3} className={styles.input} value={rating?.missing ?? ''} onChange={(e) => save({ missing: e.target.value })} />
          </label>
          <label className={styles.field}>
            Note
            <textarea rows={3} className={styles.input} value={rating?.note ?? ''} onChange={(e) => save({ note: e.target.value })} />
          </label>
        </section>
      </section>

      <aside className={styles.right} aria-label="Progress">
        <h2 className={styles.h3}>Domain {dom.id}: {dom.title}</h2>
        <ProgressBar c={domCounts} label={`Domain ${dom.id} progress`} />
        <ProgressNumbers c={domCounts} />
        <ScoreBadge kind="domain" result={domSc} compact />
        <h2 className={styles.h3}>Whole assessment</h2>
        <ProgressBar c={allCounts} label="Assessment progress" />
        <ProgressNumbers c={allCounts} />
        <ScoreBadge kind="national" result={nat} compact />
        <h2 className={styles.h3}>Rated without evidence</h2>
        {noEvidence.length === 0 ? (
          <p className={styles.muted}>None.</p>
        ) : (
          <ul className={styles.missList}>
            {noEvidence.map((x) => (
              <li key={x.s.id}>
                <button type="button" className={styles.link} onClick={() => select(x.s.id)}>
                  <span className={styles.mono}>{x.s.id}</span> {x.s.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

type C = ReturnType<typeof counts>;
function ProgressBar({ c, label }: { c: C; label: string }) {
  const rated = c[0] + c[1] + c[2] + c[3];
  const total = rated + c.unknown + c.na + c.unrated;
  const segs = [
    { n: rated, fill: `url(#${PATTERN_IDS.stage2})`, k: 'r' },
    { n: c.unknown, fill: `url(#${PATTERN_IDS.unknown})`, k: 'u' },
    { n: c.na, fill: `url(#${PATTERN_IDS.na})`, k: 'n' },
  ];
  let x = 0;
  return (
    <svg className={styles.bar} viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={`${label}: ${rated} rated of ${total}`}>
      <rect x="0" y="0" width="100" height="10" fill="var(--surface)" stroke="var(--rule)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      {total > 0 &&
        segs.map((s) => {
          const w = (s.n / total) * 100;
          const el = w > 0 ? <rect key={s.k} x={x} y="0" width={w} height="10" fill={s.fill} /> : null;
          x += w;
          return el;
        })}
    </svg>
  );
}
function ProgressNumbers({ c }: { c: C }) {
  const rated = c[0] + c[1] + c[2] + c[3];
  return (
    <dl className={styles.nums}>
      <div><dt>Rated</dt><dd>{rated}</dd></div>
      <div><dt>Unknown</dt><dd>{c.unknown}</dd></div>
      <div><dt>N/A</dt><dd>{c.na}</dd></div>
      <div><dt>Not yet rated</dt><dd>{c.unrated}</dd></div>
    </dl>
  );
}
