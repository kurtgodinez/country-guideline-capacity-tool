import { FOOTER_TEXT } from '../config';
import { framework, strategyRules } from '../data';
import { downloadText } from '../download';
import { exportAssessmentJSON, exportCSV } from '../io';
import { nationalScore, type DomainScore } from '../scoring';
import { useStore } from '../store';
import type { Assessment, Rating } from '../types';
import { ASSESSMENT_TYPE_LABEL, Button, DraftBanner, ProfileStrata, ScoreBadge, StageChip } from '../components';
import { StrategyCard } from '../components/StrategyCard';
import styles from './Report.module.css';

const pct = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x)}%`);
const fileBase = (a: Assessment) => `${a.country}-${a.asOf}`.replace(/[^A-Za-z0-9_-]+/g, '_');

export function Report({ assessmentId }: { assessmentId: string }) {
  const a = useStore((s) => s.assessments[assessmentId]);
  if (!a) return null;
  return <ReportView assessment={a} />;
}

export function ReportView({ assessment: a }: { assessment: Assessment }) {
  const nat = nationalScore(framework, a);
  const meta = { frameworkStatus: framework.status, strategyStatus: strategyRules.status };
  const exportJSON = () => downloadText(`${fileBase(a)}.json`, exportAssessmentJSON(a, meta), 'application/json');
  const exportCsv = () => downloadText(`${fileBase(a)}.csv`, exportCSV(framework, a, meta), 'text/csv');
  const mode = a.mode === 'desk' ? 'Desk assessment' : 'Full assessment';

  return (
    <article aria-labelledby="report-title" className={styles.page}>
      <div className={`${styles.toolbar} no-print`} role="toolbar" aria-label="Report actions">
        <Button onClick={exportJSON}>Export JSON</Button>
        <Button onClick={exportCsv}>Export CSV</Button>
        <Button variant="primary" onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>

      <h1 id="report-title" className={styles.title}>
        {a.country} <span className={styles.asOf}>as of {a.asOf}</span>
      </h1>
      <p className={styles.meta}>
        {mode}. Assessment type: {ASSESSMENT_TYPE_LABEL[a.assessedBy ?? 'self']}.{' '}
        {a.assessors.length ? `Assessors: ${a.assessors.join(', ')}.` : 'No assessors recorded.'}
      </p>
      <DraftBanner statusText={framework.status} label="Framework status" />
      <DraftBanner statusText={strategyRules.status} label="Strategy rules status" />
      {a.summary && <p>{a.summary}</p>}

      <h2>Scores</h2>
      <ScoreTable nat={nat} />

      <h2>Profile</h2>
      <div className={styles.strata}>
        <ProfileStrata assessment={a} framework={framework} interactive={false} standaloneDefs />
      </div>

      <h2 className={styles.pageBreak}>Ratings by domain</h2>
      {framework.domains.map((d, i) => (
        <section key={d.id} className={`${styles.domainBlock} ${i > 0 ? styles.pageBreak : ''}`} aria-label={`Domain ${d.id}`}>
          <h3>
            <span className={styles.mono}>{d.id}</span> {d.title}
          </h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Id</th>
                <th scope="col">Subdomain</th>
                <th scope="col">Stage</th>
                <th scope="col">Evidence</th>
                <th scope="col">Still missing</th>
              </tr>
            </thead>
            <tbody>
              {d.subdomains.map((s) => {
                const r: Rating | undefined = a.ratings[s.id];
                return (
                  <tr key={s.id}>
                    <td className={styles.mono}>{s.id}</td>
                    <td>{s.title}</td>
                    <td><StageChip value={r ? r.stage : 'unrated'} showText /></td>
                    <td>
                      {r && r.evidence.length > 0 ? (
                        <ul className={styles.evList}>
                          {r.evidence.map((e, k) => (
                            <li key={k}>
                              {e.text}{' '}
                              {(e.source || e.page) && <span className={styles.cite}>[{[e.source, e.page ? `p. ${e.page}` : ''].filter(Boolean).join(', ')}]</span>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className={styles.muted}>{r?.note || 'No evidence recorded'}</span>
                      )}
                    </td>
                    <td>{r?.missing || <span className={styles.muted}>-</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <h2 className={styles.pageBreak}>Provisional strategy</h2>
      <StrategyCard assessment={a} />

      <h2>Sources</h2>
      {a.sources && a.sources.length > 0 ? (
        <ol className={styles.sources}>
          {a.sources.map((s, i) => (
            <li key={i}>
              {s.id && <span className={styles.mono}>{s.id} </span>}
              <strong>{s.title}</strong>
              {s.url && <> <span className={styles.mono}>{s.url}</span></>}
              {s.note && <div className={styles.muted}>{s.note}</div>}
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.muted}>No sources listed.</p>
      )}

      <p className={styles.footer}>{FOOTER_TEXT}</p>
    </article>
  );
}

function ScoreTable({ nat }: { nat: ReturnType<typeof nationalScore> }) {
  const row = (d: DomainScore) => (
    <tr key={d.id}>
      <td className={styles.mono}>{d.id}</td>
      <td>{d.title}</td>
      <td>{d.insufficient ? <em>insufficient evidence</em> : pct(d.score)}</td>
      <td>{pct(d.coverage * 100)} ({d.rated}/{d.applicable})</td>
      <td>{pct(d.low)}–{pct(d.high)}</td>
    </tr>
  );
  return (
    <>
      <div className="no-print"><ScoreBadge kind="national" result={nat} /></div>
      <table className={styles.table}>
        <thead>
          <tr><th scope="col">Id</th><th scope="col">Domain</th><th scope="col">Score</th><th scope="col">Coverage</th><th scope="col">Range (unknown = 0 / 3)</th></tr>
        </thead>
        <tbody>
          <tr>
            <td></td>
            <th scope="row">National</th>
            <td><strong>{nat.insufficient ? <em>insufficient evidence</em> : pct(nat.score)}</strong></td>
            <td>{pct(nat.coverage * 100)} ({nat.rated}/{nat.applicable})</td>
            <td>{pct(nat.low)}–{pct(nat.high)}</td>
          </tr>
          {nat.domains.map(row)}
        </tbody>
      </table>
      <p className={styles.meta}>
        Weakest domain: {nat.weakestDomains.length ? nat.weakestDomains.map((d) => `${d.id} ${d.title} (${pct(d.score)})`).join('; ') : 'n/a'}.{' '}
        Assessment type: {ASSESSMENT_TYPE_LABEL[nat.assessmentType]}.{' '}
        {nat.equalWeights ? 'Equal domain weights.' : `Domain weights: ${Object.entries(nat.weights).map(([k, v]) => `${k}=${v}`).join(', ')}.`}
      </p>
    </>
  );
}
