import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { framework, strategyRules } from '../data';
import { ANCHOR_UNDEFINED } from '../strategy';
import type { Domain, Subdomain } from '../types';
import { DraftBanner } from '../components/DraftBanner';
import styles from './Framework.module.css';

const GATE_NONE = 'Gate not yet assigned';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Hl({ text, q }: { text: string; q: string }): ReactNode {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${esc(q)})`, 'ig'));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>));
}

const gateText = (g: { from: number; to: number } | null) => (g ? `Gate: stage ${g.from} → ${g.to}` : GATE_NONE);
const levelLabel = (v: number) => framework.scale.levels.find((l) => l.value === v)?.label ?? '';

function subdomainTexts(s: Subdomain): string[] {
  return [
    s.id,
    s.title,
    s.definition,
    ...s.questions.flatMap((q) => [q.id, q.text, gateText(q.gate)]),
    ...(s.anchors ? Object.values(s.anchors) : [ANCHOR_UNDEFINED]),
  ];
}
const domainTexts = (d: Domain) => [d.id, d.title, d.definition];

function SubdomainView({ s, q }: { s: Subdomain; q: string }) {
  return (
    <article className={styles.sub} aria-labelledby={`sd-${s.id}`}>
      <h3 id={`sd-${s.id}`}>
        <span className={styles.id}><Hl text={s.id} q={q} /></span> <Hl text={s.title} q={q} />
      </h3>
      <p><Hl text={s.definition} q={q} /></p>
      <h4>Guiding questions</h4>
      {s.questions.length === 0 ? (
        <p className={styles.muted}>No guiding questions.</p>
      ) : (
        <ol className={styles.questions}>
          {s.questions.map((qu) => (
            <li key={qu.id}>
              <span className={styles.id}><Hl text={qu.id} q={q} /></span> <Hl text={qu.text} q={q} />
              <div className={qu.gate ? styles.gate : styles.muted}><Hl text={gateText(qu.gate)} q={q} /></div>
            </li>
          ))}
        </ol>
      )}
      <h4>Anchors</h4>
      {s.anchors ? (
        <dl className={styles.anchors}>
          {(['0', '1', '2', '3'] as const).map((k) => (
            <Fragment key={k}>
              <dt>Stage {k}{levelLabel(Number(k)) ? `: ${levelLabel(Number(k))}` : ''}</dt>
              <dd><Hl text={s.anchors![k]} q={q} /></dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <p className={styles.muted}><Hl text={ANCHOR_UNDEFINED} q={q} /></p>
      )}
    </article>
  );
}

export function FrameworkScreen() {
  const [query, setQuery] = useState('');
  const q = query.trim();
  const ql = q.toLowerCase();
  const hit = (xs: string[]) => xs.some((x) => x.toLowerCase().includes(ql));

  const shown = useMemo(() => {
    if (!ql) return framework.domains.map((d) => ({ d, subs: d.subdomains }));
    return framework.domains
      .map((d) => ({ d, subs: hit(domainTexts(d)) ? d.subdomains : d.subdomains.filter((s) => hit(subdomainTexts(s))) }))
      .filter((x) => x.subs.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ql]);

  const total = framework.domains.reduce((n, d) => n + d.subdomains.length, 0);
  return (
    <section aria-labelledby="fw-title">
      <h1 id="fw-title">Framework</h1>
      <p className={styles.muted}>Read-only. {framework.domains.length} domains, {total} subdomains. Version {framework.version}.</p>
      <DraftBanner statusText={framework.status} label="Framework status" />
      <div className={styles.search}>
        <label htmlFor="fw-search">Search all framework text</label>
        <input id="fw-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <p role="status" className={styles.muted}>
        {q ? `${shown.reduce((n, x) => n + x.subs.length, 0)} subdomains match` : ''}
      </p>
      {shown.length === 0 && q && <p>No matches.</p>}
      {shown.map(({ d, subs }) => (
        <section key={d.id} className={styles.domain} aria-labelledby={`d-${d.id}`}>
          <h2 id={`d-${d.id}`}>
            <span className={styles.id}><Hl text={d.id} q={q} /></span> <Hl text={d.title} q={q} />
          </h2>
          <p><Hl text={d.definition} q={q} /></p>
          {subs.map((s) => <SubdomainView key={s.id} s={s} q={q} />)}
        </section>
      ))}
      <p className={styles.muted}>Strategy rules status: {strategyRules.status}</p>
    </section>
  );
}
