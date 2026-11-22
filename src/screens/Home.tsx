import { useRef, useState } from 'react';
import { framework, pilots, strategyRules } from '../data';
import { downloadText } from '../download';
import { exportAssessmentJSON, exportCSV } from '../io';
import { navigate, paths } from '../router';
import { counts, nationalScore } from '../scoring';
import { useStore } from '../store';
import { EMPTY_HOME } from '../strings';
import type { Assessment } from '../types';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { ScoreBadge } from '../components/ScoreBadge';
import { ASSESSMENT_TYPE_LABEL } from '../components/ScoreBadge';
import styles from './Home.module.css';

const meta = () => ({ frameworkStatus: framework.status, strategyStatus: strategyRules.status });
const fileBase = (a: Assessment) => `${a.country}-${a.asOf}`.replace(/[^\w.-]+/g, '_');

function NewForm({ onClose }: { onClose: () => void }) {
  const create = useStore((s) => s.create);
  const [country, setCountry] = useState('');
  const [asOf, setAsOf] = useState(String(new Date().getFullYear()));
  const [mode, setMode] = useState<Assessment['mode']>('desk');
  const [by, setBy] = useState<'self' | 'external'>('self');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!country.trim()) return;
    const id = create(country, asOf, mode, by);
    onClose();
    navigate(paths.assessment(id, 'workspace'));
  };
  return (
    <Dialog title="New assessment" onClose={onClose}>
      <form onSubmit={submit} className={styles.form}>
        <label>
          Country
          <input value={country} onChange={(e) => setCountry(e.target.value)} required />
        </label>
        <label>
          As of (year or date)
          <input value={asOf} onChange={(e) => setAsOf(e.target.value)} required />
        </label>
        <label>
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as Assessment['mode'])}>
            <option value="desk">Desk assessment</option>
            <option value="full">Full assessment</option>
          </select>
        </label>
        <label>
          Assessment type
          <select value={by} onChange={(e) => setBy(e.target.value as 'self' | 'external')}>
            <option value="self">Self-assessed</option>
            <option value="external">Externally assessed</option>
          </select>
        </label>
        <div className={styles.formActions}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Create</Button>
        </div>
      </form>
    </Dialog>
  );
}

function Row({ a, onDelete }: { a: Assessment; onDelete: (a: Assessment) => void }) {
  const duplicate = useStore((s) => s.duplicate);
  const national = nationalScore(framework, a);
  const c = counts(framework, a.ratings);
  const total = c[0] + c[1] + c[2] + c[3] + c.unknown + c.na + c.unrated;
  const unknownPct = total ? Math.round((c.unknown / total) * 100) : 0;
  return (
    <tr>
      <th scope="row" className={styles.country}>{a.country}</th>
      <td>{a.asOf}</td>
      <td>{a.mode === 'desk' ? 'Desk' : 'Full'}</td>
      <td>{ASSESSMENT_TYPE_LABEL[national.assessmentType]}</td>
      <td><ScoreBadge kind="national" result={national} compact /></td>
      <td>{unknownPct}%</td>
      <td>
        <div className={styles.actions}>
          <Button onClick={() => navigate(paths.assessment(a.id, 'workspace'))} aria-label={`Open ${a.country}`}>Open</Button>
          <Button onClick={() => duplicate(a.id)} aria-label={`Duplicate ${a.country}`}>Duplicate</Button>
          <Button onClick={() => downloadText(`${fileBase(a)}.json`, exportAssessmentJSON(a, meta()), 'application/json')} aria-label={`Export JSON for ${a.country}`}>Export JSON</Button>
          <Button onClick={() => downloadText(`${fileBase(a)}.csv`, exportCSV(framework, a, meta()), 'text/csv')} aria-label={`Export CSV for ${a.country}`}>Export CSV</Button>
          <Button variant="danger" onClick={() => onDelete(a)} aria-label={`Delete ${a.country}`}>Delete</Button>
        </div>
      </td>
    </tr>
  );
}

export function Home() {
  const assessments = useStore((s) => s.assessments);
  const ready = useStore((s) => s.ready);
  const importJSON = useStore((s) => s.importJSON);
  const loadPilot = useStore((s) => s.loadPilot);
  const remove = useStore((s) => s.remove);
  const [showNew, setShowNew] = useState(false);
  const [toDelete, setToDelete] = useState<Assessment | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = Object.values(assessments).sort((a, b) => a.country.localeCompare(b.country) || a.asOf.localeCompare(b.asOf));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const r = importJSON(await f.text());
    if (r.ok) {
      setErrors([]);
      setNotes(r.warnings);
    } else {
      setNotes([]);
      setErrors(r.errors);
    }
  };

  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title">Assessments</h1>
      <div className={styles.toolbar}>
        <Button variant="primary" onClick={() => setShowNew(true)}>New assessment</Button>
        <Button onClick={() => fileRef.current?.click()}>Import JSON</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className={styles.hidden} aria-label="Import assessment JSON file" tabIndex={-1} />
        {pilots.map((p) => (
          <Button key={p.id} onClick={() => loadPilot(p.id)}>Load pilot {p.label}</Button>
        ))}
      </div>
      {errors.length > 0 && (
        <div className={styles.errors} role="alert">
          <strong>Import failed. Nothing was saved.</strong>
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {notes.length > 0 && (
        <div className={styles.notes} role="status">
          <strong>Imported with notes</strong>
          <ul>{notes.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {!ready ? null : list.length === 0 ? (
        <p className={styles.empty}>{EMPTY_HOME}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Saved assessments</caption>
            <thead>
              <tr>
                <th scope="col">Country</th>
                <th scope="col">As of</th>
                <th scope="col">Mode</th>
                <th scope="col">Assessment type</th>
                <th scope="col">National score</th>
                <th scope="col">Unknown</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => <Row key={a.id} a={a} onDelete={setToDelete} />)}
            </tbody>
          </table>
        </div>
      )}
      {showNew && <NewForm onClose={() => setShowNew(false)} />}
      {toDelete && (
        <Dialog
          title="Delete assessment"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <Button onClick={() => setToDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { remove(toDelete.id); setToDelete(null); }}>Delete</Button>
            </>
          }
        >
          <p>Delete the assessment for {toDelete.country} ({toDelete.asOf}) from this browser? Export it first if you want to keep a copy. This cannot be undone.</p>
        </Dialog>
      )}
    </section>
  );
}
