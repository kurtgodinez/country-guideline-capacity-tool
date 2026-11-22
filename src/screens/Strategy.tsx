import { framework } from '../data';
import { useStore } from '../store';
import { DraftBanner } from '../components';
import { StrategyCard } from '../components/StrategyCard';

export function Strategy({ assessmentId }: { assessmentId: string }) {
  const a = useStore((s) => s.assessments[assessmentId]);
  if (!a) return null;
  return (
    <section aria-labelledby="strategy-title" style={{ maxWidth: 1000 }}>
      <h1 id="strategy-title">
        Strategy: {a.country} <span style={{ fontSize: 18, fontWeight: 400, color: 'var(--ink-muted)' }}>as of {a.asOf}</span>
      </h1>
      <DraftBanner statusText={framework.status} label="Framework status" />
      <StrategyCard assessment={a} />
    </section>
  );
}
