import { parseAssessment, parseFramework, parseStrategyRules } from './loader';
import type { Assessment, Framework, StrategyRules } from './types';
import frameworkJson from '../data/framework.json';
import rulesJson from '../data/strategy-rules.json';

const pilotModules = import.meta.glob('../data/pilots/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

export interface Pilot {
  id: string;
  label: string;
  raw: Assessment;
}

/** Errors from parsing the bundled data files; the UI shows them instead of crashing. */
export const dataErrors: string[] = [];

const EMPTY_FRAMEWORK: Framework = {
  id: 'unavailable',
  version: 'unavailable',
  status: 'Framework could not be loaded',
  scale: { levels: [], special: [] },
  domains: [],
};
const EMPTY_RULES: StrategyRules = {
  status: 'Strategy rules could not be loaded',
  groups: {},
  rules: [],
};

const fw = parseFramework(frameworkJson);
if (!fw.ok) dataErrors.push(...fw.errors.map((e) => `framework.json: ${e}`));
export const framework: Framework = fw.ok ? fw.value : EMPTY_FRAMEWORK;

const sr = parseStrategyRules(rulesJson);
if (!sr.ok) dataErrors.push(...sr.errors.map((e) => `strategy-rules.json: ${e}`));
export const strategyRules: StrategyRules = sr.ok ? sr.value : EMPTY_RULES;

export const pilots: Pilot[] = [];
for (const [path, json] of Object.entries(pilotModules).sort(([a], [b]) => a.localeCompare(b))) {
  const r = parseAssessment(json, fw.ok ? fw.value : undefined);
  if (r.ok) pilots.push({ id: r.value.id, label: r.value.country, raw: r.value });
  else dataErrors.push(...r.errors.map((e) => `${path.split('/').pop()}: ${e}`));
}
