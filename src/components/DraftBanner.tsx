import styles from './DraftBanner.module.css';

/** Visible draft status. Pass framework.status or strategyRules.status. */
export function DraftBanner({ statusText, label = 'Status' }: { statusText: string; label?: string }) {
  return (
    <div className={styles.banner} role="note">
      <strong>{label}:</strong> {statusText}
    </div>
  );
}
