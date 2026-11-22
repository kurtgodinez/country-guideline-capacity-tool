import { useMemo } from 'react';
import { framework, strategyRules } from '../data';
import { ANCHOR_UNDEFINED, applyStrategy } from '../strategy';
import type { Assessment } from '../types';
import { DraftBanner } from './DraftBanner';
import { StageChip } from './StageChip';
import styles from './StrategyCard.module.css';

const ids = (xs: string[]) => (xs.length ? xs.join(', ') : 'none');

/** Provisional strategy from the (placeholder) rules. Always carries the rules' status. */
export function StrategyCard({ assessment }: { assessment: Assessment }) {
  const r = useMemo(() => {
    try {
      return { res: applyStrategy(strategyRules, framework, assessment), error: null };
    } catch (e) {
      return { res: null, error: (e as Error).message };
    }
  }, [assessment]);

  return (
    <section className={styles.card} aria-label="Provisional strategy">
      <DraftBanner statusText={strategyRules.status} label="Strategy rules status" />
      <p className={styles.lead}>
        This is a provisional strategy produced by placeholder rules. It is a starting point for discussion, not a verdict on the country.
      </p>
      {r.error || !r.res ? (
        <p role="alert">The strategy rules could not be applied: {r.error}</p>
      ) : (
        <Body res={r.res} />
      )}
    </section>
  );
}

function Body({ res }: { res: ReturnType<typeof applyStrategy> }) {
  return (
    <>
      <h3>Group medians</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col">Median stage</th>
            <th scope="col">Included</th>
            <th scope="col">Excluded</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(res.medians).map(([g, m]) => (
            <tr key={g}>
              <th scope="row">{m.label}</th>
              <td>{m.median === null || m.insufficient ? <em>insufficient evidence</em> : m.median}</td>
              <td className={styles.mono}>{ids(m.included)}</td>
              <td className={styles.mono}>{ids([...m.excluded, ...m.unrated])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Rule that fired</h3>
      {res.fired ? (
        <p>
          <span className={styles.mono}>{res.fired.id}</span> <code className={styles.mono}>{res.fired.when}</code>
          <br />
          <strong>{res.fired.label}</strong>
        </p>
      ) : (
        <p>
          <strong>Insufficient evidence — no rule applied.</strong>
          {res.insufficientGroups.length > 0 && (
            <>
              {' '}Groups with too little evidence:{' '}
              {res.insufficientGroups.map((g) => res.medians[g]?.label ?? g).join(', ')}.
            </>
          )}
        </p>
      )}

      <h3>Blocking subdomains</h3>
      {res.blocking.length === 0 ? (
        <p className={styles.muted}>None.</p>
      ) : (
        <ul className={styles.blocking}>
          {res.blocking.map((b) => (
            <li key={b.id}>
              <StageChip value={b.stage} showText />
              <span className={styles.mono}>{b.id}</span> {b.title}
            </li>
          ))}
        </ul>
      )}

      <h3>Next steps</h3>
      {res.nextSteps.length === 0 ? (
        <p className={styles.muted}>No rated subdomains below stage 3.</p>
      ) : (
        <ol className={styles.steps}>
          {res.nextSteps.map((n) => (
            <li key={n.id}>
              <span className={styles.mono}>{n.id}</span> <strong>{n.title}</strong>: stage {n.stage} → stage {n.nextStage}
              <div className={n.anchorText === ANCHOR_UNDEFINED ? styles.muted : undefined}>{n.anchorText}</div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
