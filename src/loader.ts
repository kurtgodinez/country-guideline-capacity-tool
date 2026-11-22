import { z } from 'zod';
import type { Assessment, Framework, StrategyRules } from './types';

export type ParseResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const stageSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal('unknown'),
  z.literal('na'),
]);

const evidenceSchema = z.object({
  text: z.string(),
  source: z.string().optional(),
  page: z.string().optional(),
  url: z.string().optional(),
  quote: z.string().optional(),
});

const answerSchema = z.object({
  answer: z.enum(['yes', 'partly', 'no', 'unknown']),
  note: z.string().optional(),
});

const ratingSchema = z.object({
  stage: stageSchema,
  evidence: z.array(evidenceSchema),
  note: z.string().optional(),
  missing: z.string().optional(),
  answers: z.record(z.string(), answerSchema).optional(),
  assessor: z.string().optional(),
  updatedAt: z.string().optional(),
  stageOverrideReason: z.string().optional(),
});

const assessmentShell = z.object({
  id: z.string(),
  country: z.string(),
  asOf: z.string(),
  mode: z.enum(['desk', 'full']),
  assessedBy: z.enum(['self', 'external']).optional(),
  assessedByNote: z.string().optional(),
  assessors: z.array(z.string()),
  framework: z.string(),
  summary: z.string().optional(),
  sources: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string(),
        url: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  ratings: z.record(z.string(), z.unknown()),
  secondAssessor: z
    .object({ name: z.string(), ratings: z.record(z.string(), z.unknown()) })
    .optional(),
});

const anchorsSchema = z.object({
  '0': z.string(),
  '1': z.string(),
  '2': z.string(),
  '3': z.string(),
});

const frameworkSchema = z.object({
  id: z.string(),
  version: z.string(),
  status: z.string(),
  question: z.string().optional(),
  principle: z.string().optional(),
  scale: z.object({
    source: z.string().optional(),
    levels: z.array(
      z.object({
        value: z.number(),
        label: z.string(),
        description: z.string(),
        look: z.string().optional(),
      }),
    ),
    special: z.array(
      z.object({
        value: z.enum(['unknown', 'na']),
        label: z.string(),
        description: z.string(),
      }),
    ),
  }),
  domains: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      definition: z.string(),
      subdomains: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          definition: z.string(),
          questions: z.array(
            z.object({
              id: z.string(),
              text: z.string(),
              gate: z.object({ from: z.number(), to: z.number() }).nullable(),
            }),
          ),
          anchors: anchorsSchema.nullable(),
        }),
      ),
    }),
  ),
  scoring: z
    .object({
      subdomain: z.string().optional(),
      domain: z.string().optional(),
      national: z.string().optional(),
      weights: z.record(z.string(), z.number()).nullable().optional(),
      minCoverage: z.number().min(0).max(1).optional(),
      unknown: z.string().optional(),
      na: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
  weights: z.record(z.string(), z.number()).nullable().optional(),
  minCoverage: z.number().min(0).max(1).optional(),
});

const strategySchema = z.object({
  status: z.string(),
  purpose: z.string().optional(),
  unknownHandling: z.string().optional(),
  groups: z.record(
    z.string(),
    z.object({ label: z.string(), subdomains: z.array(z.string()) }),
  ),
  rules: z.array(
    z.object({
      id: z.string(),
      when: z.string(),
      result: z.string(),
      label: z.string(),
    }),
  ),
  alwaysShow: z.array(z.string()).optional(),
});

function fmtPath(path: PropertyKey[]): string {
  return path.map(String).join('.');
}

function describeIssue(issue: z.core.$ZodIssue, prefix = ''): string {
  let path = issue.path;
  let msg = issue.message;
  // Friendlier text for the most common mistake; names the subdomain, not the field.
  if (path[path.length - 1] === 'stage') {
    path = path.slice(0, -1);
    msg = 'stage must be 0-3, unknown or na';
  }
  const full = [prefix, fmtPath(path)].filter(Boolean).join('.');
  return full ? `${full}: ${msg}` : msg;
}

function zodErrors(err: z.ZodError, prefix = ''): string[] {
  return err.issues.map((i) => describeIssue(i, prefix));
}

function genericParse<T>(schema: z.ZodType<T>, json: unknown, label: string): ParseResult<T> {
  try {
    const r = schema.safeParse(json);
    if (r.success) return { ok: true, value: r.data, warnings: [] };
    return { ok: false, errors: zodErrors(r.error), warnings: [] };
  } catch (e) {
    return { ok: false, errors: [`${label}: ${String(e)}`], warnings: [] };
  }
}

export function parseFramework(json: unknown): ParseResult<Framework> {
  const r = genericParse(frameworkSchema, json, 'framework');
  if (!r.ok) return r;
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const d of r.value.domains)
    for (const s of d.subdomains) {
      if (seen.has(s.id)) errors.push(`${s.id}: duplicate subdomain id`);
      seen.add(s.id);
    }
  if (errors.length) return { ok: false, errors, warnings: [] };
  return { ok: true, value: r.value as Framework, warnings: [] };
}

export function parseStrategyRules(json: unknown): ParseResult<StrategyRules> {
  return genericParse(strategySchema, json, 'strategy rules') as ParseResult<StrategyRules>;
}

/** Validate an assessment. Errors are keyed by subdomain id ("ratings.3.4: ..."). Never throws. */
export function parseAssessment(json: unknown, framework?: Framework): ParseResult<Assessment> {
  try {
    const shell = assessmentShell.safeParse(json);
    if (!shell.success) return { ok: false, errors: zodErrors(shell.error), warnings: [] };
    const errors: string[] = [];
    const warnings: string[] = [];
    const ratings: Record<string, unknown> = {};
    for (const [id, raw] of Object.entries(shell.data.ratings)) {
      const r = ratingSchema.safeParse(raw);
      if (r.success) ratings[id] = r.data;
      else errors.push(...zodErrors(r.error, `ratings.${id}`));
    }
    let second: { name: string; ratings: Record<string, unknown> } | undefined;
    if (shell.data.secondAssessor) {
      second = { name: shell.data.secondAssessor.name, ratings: {} };
      for (const [id, raw] of Object.entries(shell.data.secondAssessor.ratings)) {
        const r = ratingSchema.safeParse(raw);
        if (r.success) second.ratings[id] = r.data;
        else errors.push(...zodErrors(r.error, `secondAssessor.ratings.${id}`));
      }
    }
    if (framework) {
      const known = new Set(framework.domains.flatMap((d) => d.subdomains.map((s) => s.id)));
      for (const id of Object.keys(ratings))
        if (!known.has(id))
          warnings.push(`ratings.${id}: subdomain id not in framework ${framework.version}; ignored in scoring`);
      if (shell.data.framework !== framework.version)
        warnings.push(
          `framework: assessment was made against ${shell.data.framework}, loaded framework is ${framework.version}`,
        );
    }
    if (errors.length) return { ok: false, errors, warnings };
    const value = { ...shell.data, ratings, ...(second ? { secondAssessor: second } : {}) } as unknown as Assessment;
    return { ok: true, value, warnings };
  } catch (e) {
    return { ok: false, errors: [`assessment: ${String(e)}`], warnings: [] };
  }
}
