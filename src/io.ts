import { parseAssessment, type ParseResult } from './loader';
import type { Assessment, Framework } from './types';

export interface ExportMeta {
  frameworkStatus: string;
  strategyStatus: string;
}

export function exportAssessmentJSON(assessment: Assessment, meta: ExportMeta): string {
  const _meta = {
    frameworkStatus: meta.frameworkStatus,
    strategyStatus: meta.strategyStatus,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify({ _meta, ...assessment }, null, 2);
}

export function importAssessmentJSON(text: string, framework: Framework): ParseResult<Assessment> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`], warnings: [] };
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const { _meta: _ignored, ...rest } = raw as Record<string, unknown>;
    raw = rest;
  }
  return parseAssessment(raw, framework);
}

function esc(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function exportCSV(
  framework: Framework,
  assessment: Assessment,
  statuses: ExportMeta,
): string {
  const lines: string[] = [
    `# Framework status: ${statuses.frameworkStatus}`,
    `# Strategy rules status: ${statuses.strategyStatus}`,
    `# Assessment: ${assessment.country} (as of ${assessment.asOf}, ${assessment.mode})`,
  ].map((l) => l.replace(/[\r\n]+/g, ' '));
  lines.push(
    ['domain_id', 'domain_title', 'subdomain_id', 'subdomain_title', 'stage', 'evidence', 'note', 'missing']
      .map(esc)
      .join(','),
  );
  for (const d of framework.domains)
    for (const s of d.subdomains) {
      const r = assessment.ratings[s.id];
      const evidence = (r?.evidence ?? [])
        .map((e) => {
          const src = [e.source, e.page ? `p. ${e.page}` : ''].filter(Boolean).join(', ');
          return src ? `${e.text} (${src})` : e.text;
        })
        .join(' | ');
      lines.push(
        [d.id, d.title, s.id, s.title, r ? String(r.stage) : 'unrated', evidence, r?.note ?? '', r?.missing ?? '']
          .map(esc)
          .join(','),
      );
    }
  return lines.join('\r\n') + '\r\n';
}
