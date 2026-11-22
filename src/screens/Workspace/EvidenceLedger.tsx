import { useState } from 'react';
import { Button } from '../../components';
import type { Evidence } from '../../types';
import styles from './Workspace.module.css';

const EMPTY: Evidence = { text: '' };

function clean(e: Evidence): Evidence {
  const out: Evidence = { text: e.text.trim() };
  for (const k of ['source', 'page', 'url', 'quote'] as const) {
    const v = e[k]?.trim();
    if (v) out[k] = v;
  }
  return out;
}

function Form({ initial, submitLabel, onSubmit, onCancel }: { initial: Evidence; submitLabel: string; onSubmit: (e: Evidence) => void; onCancel?: () => void }) {
  const [e, setE] = useState<Evidence>(initial);
  const f = (k: keyof Evidence) => ({
    value: e[k] ?? '',
    onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setE({ ...e, [k]: ev.target.value }),
  });
  return (
    <form
      className={styles.evForm}
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!e.text.trim()) return;
        onSubmit(clean(e));
        setE(EMPTY);
      }}
    >
      <label>
        Evidence text
        <textarea rows={2} {...f('text')} required />
      </label>
      <div className={styles.evRow}>
        <label>
          Source
          <input type="text" {...f('source')} />
        </label>
        <label>
          Page
          <input type="text" {...f('page')} />
        </label>
      </div>
      <label>
        URL
        <input type="text" inputMode="url" {...f('url')} />
      </label>
      <label>
        Quote
        <textarea rows={2} {...f('quote')} />
      </label>
      <div className={styles.evActions}>
        <Button type="submit" variant="primary" disabled={!e.text.trim()}>
          {submitLabel}
        </Button>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

export function EvidenceLedger({ entries, onChange }: { entries: Evidence[]; onChange: (e: Evidence[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <section aria-labelledby="ev-h" className={styles.block}>
      <h3 id="ev-h" className={styles.h3}>Evidence ledger</h3>
      {entries.length === 0 && <p className={styles.muted}>No evidence entries yet.</p>}
      <ol className={styles.evList}>
        {entries.map((e, i) =>
          editing === i ? (
            <li key={i}>
              <Form
                initial={e}
                submitLabel="Save entry"
                onSubmit={(n) => {
                  onChange(entries.map((x, j) => (j === i ? n : x)));
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={i} className={styles.evItem}>
              <p className={styles.evText}>{e.text}</p>
              {(e.source || e.page) && (
                <p className={styles.cite}>
                  {e.source}
                  {e.source && e.page ? ', ' : ''}
                  {e.page && `p. ${e.page}`}
                </p>
              )}
              {e.url && <p className={styles.cite}>{e.url}</p>}
              {e.quote && <blockquote className={styles.cite}>&ldquo;{e.quote}&rdquo;</blockquote>}
              <div className={styles.evActions}>
                <Button variant="link" onClick={() => setEditing(i)} aria-label={`Edit evidence ${i + 1}`}>Edit</Button>
                <Button variant="link" onClick={() => onChange(entries.filter((_, j) => j !== i))} aria-label={`Remove evidence ${i + 1}`}>Remove</Button>
              </div>
            </li>
          ),
        )}
      </ol>
      {editing === null && (
        <details className={styles.addEv} open={entries.length === 0}>
          <summary>Add evidence entry</summary>
          <Form initial={EMPTY} submitLabel="Add entry" onSubmit={(n) => onChange([...entries, n])} />
        </details>
      )}
    </section>
  );
}
