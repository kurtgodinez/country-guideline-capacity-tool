import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { framework, pilots } from './data';
import { importAssessmentJSON } from './io';
import type { Assessment, Rating } from './types';

const DB_KEY = 'cgct.assessments.v1';

export type ImportResult = { ok: true; id: string; warnings: string[] } | { ok: false; errors: string[] };
export type MetaPatch = Partial<
  Pick<Assessment, 'country' | 'asOf' | 'mode' | 'assessedBy' | 'assessedByNote' | 'summary' | 'assessors'>
>;

interface State {
  assessments: Record<string, Assessment>;
  /** True once IndexedDB has been read (or failed). */
  ready: boolean;
  currentAssessmentId: string | null;
  compareIds: string[];

  hydrate: () => Promise<void>;
  create: (country: string, asOf: string, mode: Assessment['mode'], assessedBy: 'self' | 'external') => string;
  importJSON: (text: string) => ImportResult;
  loadPilot: (pilotId: string) => string | null;
  duplicate: (id: string) => string | null;
  remove: (id: string) => void;
  setRating: (assessmentId: string, subdomainId: string, partial: Partial<Rating>) => void;
  setSecondAssessor: (assessmentId: string, second: Assessment['secondAssessor'] | undefined) => void;
  updateMeta: (assessmentId: string, patch: MetaPatch) => void;
  setCurrentAssessmentId: (id: string | null) => void;
  setCompareIds: (ids: string[]) => void;
}

function newId(): string {
  const c = globalThis.crypto;
  return c && 'randomUUID' in c ? c.randomUUID() : `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export const useStore = create<State>((set, getState) => {
  const put = (a: Assessment) => set((s) => ({ assessments: { ...s.assessments, [a.id]: a } }));
  const patch = (id: string, fn: (a: Assessment) => Assessment) => {
    const a = getState().assessments[id];
    if (a) put(fn(a));
  };
  return {
    assessments: {},
    ready: false,
    currentAssessmentId: null,
    compareIds: [],

    hydrate: async () => {
      try {
        const saved = await idbGet<Record<string, Assessment>>(DB_KEY);
        // Anything created before hydration finished wins over stored copies with the same id.
        if (saved && typeof saved === 'object') set((s) => ({ assessments: { ...saved, ...s.assessments } }));
      } catch {
        /* storage unavailable: continue in memory */
      }
      set({ ready: true });
    },

    create: (country, asOf, mode, assessedBy) => {
      const id = newId();
      put({ id, country: country.trim(), asOf: asOf.trim(), mode, assessedBy, assessors: [], framework: framework.version, ratings: {} });
      return id;
    },

    importJSON: (text) => {
      const r = importAssessmentJSON(text, framework);
      if (!r.ok) return { ok: false, errors: r.errors };
      const warnings = [...r.warnings];
      let a = r.value;
      if (getState().assessments[a.id]) {
        const id = newId();
        warnings.push(`An assessment with id "${a.id}" already exists; imported as a new copy.`);
        a = { ...a, id };
      }
      put(a);
      return { ok: true, id: a.id, warnings };
    },

    loadPilot: (pilotId) => {
      const p = pilots.find((x) => x.id === pilotId);
      if (!p) return null;
      put(clone(p.raw)); // same id, so reloading replaces
      return p.raw.id;
    },

    duplicate: (id) => {
      const a = getState().assessments[id];
      if (!a) return null;
      const copy = clone(a);
      copy.id = newId();
      copy.country = `${a.country} (copy)`;
      put(copy);
      return copy.id;
    },

    remove: (id) =>
      set((s) => {
        const { [id]: _gone, ...rest } = s.assessments;
        return {
          assessments: rest,
          currentAssessmentId: s.currentAssessmentId === id ? null : s.currentAssessmentId,
          compareIds: s.compareIds.filter((x) => x !== id),
        };
      }),

    setRating: (aid, sid, partial) =>
      patch(aid, (a) => {
        const base: Rating = a.ratings[sid] ?? { stage: 'unknown', evidence: [] };
        return { ...a, ratings: { ...a.ratings, [sid]: { ...base, ...partial, updatedAt: new Date().toISOString() } } };
      }),

    setSecondAssessor: (aid, second) =>
      patch(aid, (a) => {
        const { secondAssessor: _old, ...rest } = a;
        return second ? { ...rest, secondAssessor: second } : rest;
      }),

    updateMeta: (aid, p) => patch(aid, (a) => ({ ...a, ...p })),
    setCurrentAssessmentId: (id) => set({ currentAssessmentId: id }),
    setCompareIds: (ids) => set({ compareIds: ids.slice(0, 2) }),
  };
});

// Persist on change, once hydrated.
useStore.subscribe((s, prev) => {
  if (!s.ready || s.assessments === prev.assessments) return;
  void (async () => {
    try {
      await idbSet(DB_KEY, s.assessments);
    } catch {
      /* ignore */
    }
  })();
});
