import type { Assessment, Framework, Rating, StrategyRule, StrategyRules } from './types';

// ---------- Expression language ----------
// expr    := or
// or      := and ('OR' and)*
// and     := cmp ('AND' cmp)*
// cmp     := value (('>='|'<='|'>'|'<'|'==') value)?   (a bare value is not a boolean: error)
// value   := NUMBER | 'median' '(' IDENT ')' | 'stage' '(' STRING ')' | '(' or ')'
// The whole expression may instead be the bare keyword `otherwise`.

export type CmpOp = '>=' | '<=' | '>' | '<' | '==';
export type Expr =
  | { t: 'otherwise' }
  | { t: 'or' | 'and'; l: Expr; r: Expr }
  | { t: 'cmp'; op: CmpOp; l: Value; r: Value };
export type Value =
  | { t: 'num'; v: number }
  | { t: 'median'; group: string }
  | { t: 'stage'; id: string };

type Tok = { k: 'num' | 'id' | 'str' | 'op' | 'lp' | 'rp'; v: string; pos: number };

export class ExpressionError extends Error {}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === '(') out.push({ k: 'lp', v: c, pos: i++ });
    else if (c === ')') out.push({ k: 'rp', v: c, pos: i++ });
    else if (/[<>=]/.test(c)) {
      const two = src.slice(i, i + 2);
      if (two === '>=' || two === '<=' || two === '==') {
        out.push({ k: 'op', v: two, pos: i });
        i += 2;
      } else if (c === '>' || c === '<') out.push({ k: 'op', v: c, pos: i++ });
      else throw new ExpressionError(`Unexpected '=' at position ${i} (use '==')`);
    } else if (/[0-9]/.test(c)) {
      const m = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i))!;
      out.push({ k: 'num', v: m[0], pos: i });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ k: 'id', v: m[0], pos: i });
      i += m[0].length;
    } else if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new ExpressionError(`Unterminated string at position ${i}`);
      out.push({ k: 'str', v: src.slice(i + 1, end), pos: i });
      i = end + 1;
    } else throw new ExpressionError(`Unexpected character '${c}' at position ${i}`);
  }
  return out;
}

export function parseExpression(src: string): Expr {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const fail = (msg: string): never => {
    const t = toks[p];
    throw new ExpressionError(`${msg}${t ? ` at position ${t.pos} ('${t.v}')` : ' at end of expression'}`);
  };
  const isKw = (t: Tok | undefined, kw: string) => !!t && t.k === 'id' && t.v === kw;
  const expect = (k: Tok['k'], what: string): Tok => {
    const t = peek();
    if (!t || t.k !== k) return fail(`Expected ${what}`);
    p++;
    return t;
  };

  function value(): Value {
    const t = peek();
    if (!t) return fail('Expected a value');
    if (t.k === 'num') {
      p++;
      return { t: 'num', v: Number(t.v) };
    }
    if (isKw(t, 'median')) {
      p++;
      expect('lp', "'('");
      const id = expect('id', 'group name');
      expect('rp', "')'");
      return { t: 'median', group: id.v };
    }
    if (isKw(t, 'stage')) {
      p++;
      expect('lp', "'('");
      const s = expect('str', "quoted subdomain id, e.g. '5.3'");
      expect('rp', "')'");
      return { t: 'stage', id: s.v };
    }
    return fail('Expected a number, median(...) or stage(...)');
  }
  function cmp(): Expr {
    if (peek()?.k === 'lp') {
      p++;
      const e = or();
      expect('rp', "')'");
      return e;
    }
    const l = value();
    const op = peek();
    if (!op || op.k !== 'op') return fail('Expected a comparison operator');
    p++;
    const r = value();
    return { t: 'cmp', op: op.v as CmpOp, l, r };
  }
  function and(): Expr {
    let e = cmp();
    while (isKw(peek(), 'AND')) {
      p++;
      e = { t: 'and', l: e, r: cmp() };
    }
    return e;
  }
  function or(): Expr {
    let e = and();
    while (isKw(peek(), 'OR')) {
      p++;
      e = { t: 'or', l: e, r: and() };
    }
    return e;
  }

  if (toks.length === 1 && isKw(toks[0], 'otherwise')) return { t: 'otherwise' };
  if (toks.length === 0) throw new ExpressionError('Empty expression');
  const e = or();
  if (p < toks.length) fail('Unexpected token');
  return e;
}

/** Group names referenced by median(...) in an expression. */
export function referencedGroups(e: Expr): string[] {
  const out = new Set<string>();
  const walk = (x: Expr | Value): void => {
    if (x.t === 'median') out.add(x.group);
    else if (x.t === 'and' || x.t === 'or') (walk(x.l), walk(x.r));
    else if (x.t === 'cmp') (walk(x.l), walk(x.r));
  };
  walk(e);
  return [...out];
}

// ---------- Evaluation ----------
export type NumericOrNull = number | null;

export interface EvalContext {
  median: (group: string) => NumericOrNull;
  stage: (id: string) => NumericOrNull;
}

export function evaluateExpression(e: Expr, ctx: EvalContext, earlierFired = false): boolean {
  switch (e.t) {
    case 'otherwise':
      return !earlierFired;
    case 'and':
      return evaluateExpression(e.l, ctx) && evaluateExpression(e.r, ctx);
    case 'or':
      return evaluateExpression(e.l, ctx) || evaluateExpression(e.r, ctx);
    case 'cmp': {
      const val = (v: Value): NumericOrNull =>
        v.t === 'num' ? v.v : v.t === 'median' ? ctx.median(v.group) : ctx.stage(v.id);
      const a = val(e.l);
      const b = val(e.r);
      if (a === null || b === null) return false;
      switch (e.op) {
        case '>=': return a >= b;
        case '<=': return a <= b;
        case '>': return a > b;
        case '<': return a < b;
        case '==': return a === b;
      }
    }
  }
}

// ---------- Strategy ----------
export interface GroupMedian {
  label: string;
  median: number | null;
  /** Subdomain ids whose numeric stage entered the median. */
  included: string[];
  /** Subdomain ids rated unknown or na. */
  excluded: string[];
  /** Subdomain ids with no rating at all. */
  unrated: string[];
  /** More than half of the group's subdomains are unknown or unrated. */
  insufficient: boolean;
}
export interface IdTitle {
  id: string;
  title: string;
}
export interface NextStep extends IdTitle {
  stage: 0 | 1 | 2;
  nextStage: 1 | 2 | 3;
  anchorText: string;
}
export interface StrategyResult {
  status: string;
  medians: Record<string, GroupMedian>;
  fired: StrategyRule | null;
  insufficientEvidence: boolean;
  /** Groups that caused insufficientEvidence. */
  insufficientGroups: string[];
  blocking: (IdTitle & { stage: 0 | 'unknown' | 'unrated' })[];
  nextSteps: NextStep[];
}

export const ANCHOR_UNDEFINED = 'Anchor not yet defined';

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function applyStrategy(rules: StrategyRules, fw: Framework, a: Assessment): StrategyResult {
  const subs = fw.domains.flatMap((d) => d.subdomains);
  const byId = new Map(subs.map((s) => [s.id, s]));
  const title = (id: string) => byId.get(id)?.title ?? id;
  const rating = (id: string): Rating | undefined => a.ratings[id];

  const medians: Record<string, GroupMedian> = {};
  for (const [g, def] of Object.entries(rules.groups)) {
    const included: string[] = [];
    const excluded: string[] = [];
    const unrated: string[] = [];
    const nums: number[] = [];
    for (const id of def.subdomains) {
      const r = rating(id);
      if (!r) unrated.push(id);
      else if (r.stage === 'unknown' || r.stage === 'na') excluded.push(id);
      else (included.push(id), nums.push(r.stage));
    }
    const unknownCount = unrated.length + def.subdomains.filter((id) => rating(id)?.stage === 'unknown').length;
    medians[g] = {
      label: def.label,
      median: median(nums),
      included,
      excluded,
      unrated,
      insufficient: unknownCount * 2 > def.subdomains.length || nums.length === 0,
    };
  }

  const ctx: EvalContext = {
    median: (g) => {
      const m = medians[g];
      if (!m) throw new ExpressionError(`Unknown group '${g}'`);
      return m.median;
    },
    stage: (id) => {
      const s = rating(id)?.stage;
      return typeof s === 'number' ? s : null;
    },
  };

  let fired: StrategyRule | null = null;
  let insufficientGroups: string[] = [];
  for (const rule of rules.rules) {
    const ast = parseExpression(rule.when);
    const bad = referencedGroups(ast).filter((g) => {
      if (!medians[g]) throw new ExpressionError(`Rule ${rule.id}: unknown group '${g}'`);
      return medians[g].insufficient;
    });
    if (bad.length) {
      insufficientGroups = bad;
      break;
    }
    if (evaluateExpression(ast, ctx, false)) {
      fired = rule;
      break;
    }
  }

  const seen = new Set<string>();
  const blocking: StrategyResult['blocking'] = [];
  for (const def of Object.values(rules.groups))
    for (const id of def.subdomains) {
      if (seen.has(id)) continue;
      const r = rating(id);
      const st = r ? r.stage : 'unrated';
      if (st === 0 || st === 'unknown' || st === 'unrated') {
        seen.add(id);
        blocking.push({ id, title: title(id), stage: st });
      }
    }

  const rated = subs
    .filter((s) => {
      const st = rating(s.id)?.stage;
      return typeof st === 'number' && st < 3;
    })
    .map((s) => ({ s, st: rating(s.id)!.stage as 0 | 1 | 2 }));
  rated.sort((x, y) => x.st - y.st); // stable: ties keep framework order
  const nextSteps: NextStep[] = rated.slice(0, 3).map(({ s, st }) => {
    const nextStage = (st + 1) as 1 | 2 | 3;
    return {
      id: s.id,
      title: s.title,
      stage: st,
      nextStage,
      anchorText: s.anchors?.[String(nextStage) as '1' | '2' | '3'] || ANCHOR_UNDEFINED,
    };
  });

  return {
    status: rules.status,
    medians,
    fired,
    insufficientEvidence: insufficientGroups.length > 0,
    insufficientGroups,
    blocking,
    nextSteps,
  };
}
