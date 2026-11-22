import { Dialog } from './Dialog';
import { Button } from './Button';
import type { DomainScore, NationalScore } from '../scoring';
import type { Framework } from '../types';
import styles from './HowMadePanel.module.css';

export type ScoreResult =
  | { kind: 'national'; result: NationalScore }
  | { kind: 'domain'; result: DomainScore };

function IdList({ ids, titles }: { ids: string[]; titles: Map<string, string> }) {
  if (!ids.length) return <p className={styles.none}>None</p>;
  return (
    <ul className={styles.list}>
      {ids.map((id) => (
        <li key={id}>
          <span className={styles.id}>{id}</span> {titles.get(id) ?? ''}
        </li>
      ))}
    </ul>
  );
}

export function HowMadePanel({ framework, onClose, ...score }: { framework: Framework; onClose: () => void } & ScoreResult) {
  const titles = new Map<string, string>();
  for (const d of framework.domains) for (const s of d.subdomains) titles.set(s.id, s.title);
  const domainTitles = new Map(framework.domains.map((d) => [d.id, d.title] as const));

  const sub = (r: DomainScore | NationalScore) => (
    <>
      <h3>Included (rated 0–3)</h3>
      <IdList ids={'includedIds' in r ? r.includedIds : []} titles={titles} />
      <h3>Dropped: unknown</h3>
      <IdList ids={r.unknownIds} titles={titles} />
      <h3>Dropped: not applicable</h3>
      <IdList ids={r.naIds} titles={titles} />
      <h3>Not yet rated</h3>
      <IdList ids={r.unratedIds} titles={titles} />
    </>
  );

  return (
    <Dialog title="How this number was made" onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <p className={styles.formula}>{score.result.formula}</p>
      <p>
        Coverage: {score.result.rated} rated of {score.result.applicable} applicable. Minimum coverage for a number: {Math.round(score.result.minCoverage * 100)}%.
      </p>
      {score.kind === 'domain' ? (
        sub(score.result)
      ) : (
        <>
          <h3>Weights {score.result.equalWeights ? '(equal)' : '(not equal)'}</h3>
          <ul className={styles.list}>
            {framework.domains.map((d) => {
              const included = score.result.includedDomainIds.includes(d.id);
              return (
                <li key={d.id}>
                  <span className={styles.id}>{d.id}</span> {domainTitles.get(d.id)}: weight {score.result.weights[d.id] ?? 1}
                  {included ? '' : ' (dropped: no rated subdomains)'}
                </li>
              );
            })}
          </ul>
          <h3>Subdomains across all domains</h3>
          {sub(score.result)}
        </>
      )}
    </Dialog>
  );
}
