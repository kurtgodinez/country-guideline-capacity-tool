import { framework } from '../data';
import { counts, nationalScore } from '../scoring';
import { paths } from '../router';
import { useStore } from '../store';
import type { Assessment } from '../types';
import { DraftBanner, PATTERN_IDS, ProfileStrata, ScoreBadge, StrataLegend } from '../components';
import styles from './Profile.module.css';

const SEGMENTS: { key: '0' | '1' | '2' | '3' | 'unknown' | 'na' | 'unrated'; label: string; fill: string }[] = [
  { key: '0', label: 'stage 0', fill: `url(#${PATTERN_IDS.stage0})` },
  { key: '1', label: 'stage 1', fill: `url(#${PATTERN_IDS.stage1})` },
  { key: '2', label: 'stage 2', fill: `url(#${PATTERN_IDS.stage2})` },
  { key: '3', label: 'stage 3', fill: `url(#${PATTERN_IDS.stage3})` },
  { key: 'unknown', label: 'unknown', fill: `url(#${PATTERN_IDS.unknown})` },
  { key: 'na', label: 'not applicable', fill: 'var(--surface)' },
  { key: 'unrated', label: 'not yet rated', fill: 'var(--surface)' },
];

export function Profile({ assessmentId }: { assessmentId: string }) {
  const a = useStore((s) => s.assessments[assessmentId]);
  if (!a) return null;
  return <ProfileView assessment={a} />;
}

export function ProfileView({ assessment: a }: { assessment: Assessment }) {
  const nat = nationalScore(framework, a);
  const modeLabel = a.mode === 'desk' ? 'Desk assessment' : 'Full assessment';
  return (
    <section aria-labelledby="profile-title" className={styles.page}>
      <h1 id="profile-title" className={styles.title}>
        {a.country} <span className={styles.asOf}>as of {a.asOf}</span>
      </h1>
      <DraftBanner statusText={framework.status} label="Framework status" />
      <div className={styles.headline}>
        <ScoreBadge kind="national" result={nat} />
        <p className={styles.type}>
          {modeLabel}. {a.assessors.length ? `Assessors: ${a.assessors.join(', ')}.` : ''}
        </p>
      </div>
      {a.summary && <p className={styles.summary}>{a.summary}</p>}

      <h2>Profile</h2>
      <ProfileStrata assessment={a} framework={framework} />

      <h2>Distribution of stages by domain</h2>
      <Distribution assessment={a} />

      <h2>Evidence needed</h2>
      <EvidenceNeeded assessment={a} />
    </section>
  );
}

function Distribution({ assessment: a }: { assessment: Assessment }) {
  const BAR_W = 360;
  return (
    <div>
      <ul className={styles.dist}>
        {framework.domains.map((d) => {
          const c = counts({ ...framework, domains: [d] }, a.ratings);
          const total = d.subdomains.length || 1;
          let x = 0;
          const desc = SEGMENTS.filter((s) => c[s.key as keyof typeof c] > 0)
            .map((s) => `${c[s.key as keyof typeof c]} ${s.label}`)
            .join(', ');
          return (
            <li key={d.id}>
              <span className={styles.distLabel}>
                <span className={styles.mono}>{d.id}</span> {d.title}
              </span>
              <svg viewBox={`0 0 ${BAR_W} 18`} width="100%" style={{ maxWidth: BAR_W }} role="img" aria-label={`Domain ${d.id} stage distribution: ${desc}`}>
                {SEGMENTS.map((s) => {
                  const n = c[s.key as keyof typeof c];
                  if (!n) return null;
                  const w = (n / total) * BAR_W;
                  const r = (
                    <rect key={s.key} x={x} y={0.5} width={w} height={17} fill={s.fill} stroke="var(--ink-muted)" strokeWidth="1" strokeDasharray={s.key === 'unrated' ? '3 3' : undefined} />
                  );
                  x += w;
                  return r;
                })}
              </svg>
              <span className={styles.distText}>{desc}</span>
            </li>
          );
        })}
      </ul>
      <StrataLegend />
    </div>
  );
}

function EvidenceNeeded({ assessment: a }: { assessment: Assessment }) {
  const groups = framework.domains
    .map((d) => ({ d, items: d.subdomains.filter((s) => a.ratings[s.id]?.stage === 'unknown') }))
    .filter((g) => g.items.length > 0);
  if (groups.length === 0) return <p className={styles.muted}>No unknown subdomains.</p>;
  return (
    <div>
      {groups.map(({ d, items }) => (
        <div key={d.id} className={styles.needGroup}>
          <h3>
            <span className={styles.mono}>{d.id}</span> {d.title}
          </h3>
          <ul>
            {items.map((s) => (
              <li key={s.id}>
                <a href={`${paths.assessment(a.id, 'workspace')}?s=${encodeURIComponent(s.id)}`}>
                  <span className={styles.mono}>{s.id}</span> {s.title}
                </a>
                : {a.ratings[s.id]?.missing || <span className={styles.muted}>no note on what would settle it</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
