# Country Guideline Capacity Tool

An offline prototype from CERC, Humanitas University (a WHO Collaborating Centre), for rating a country's capacity to plan, produce or adapt, and use clinical and public-health guidelines. It turns ratings into a profile and a provisional strategy.

This is a draft for working-group review. It is not validated, and the framework, scoring and strategy rules are not agreed.

## Screens

- **Home**: saved assessments; create, import, load a pilot, open, duplicate, export, delete.
- **Framework**: read-only browser of the domains, subdomains, questions, anchors and gates, with search.
- **Workspace**: rate subdomains (stage, guiding questions, gates, evidence ledger, still missing).
- **Profile**: national score, domain scores and the stage strata for one assessment.
- **Compare**: two assessments on the same grid, with differences marked.
- **Strategy**: applies `data/strategy-rules.json` to a profile and shows the rule that fired.
- **Reconcile**: second-assessor import, agreement per subdomain and weighted kappa.
- **Report**: print-ready A4 page with scores, tables, strategy card and sources. Export JSON, CSV or print to PDF.

## Run it

```sh
npm install
npm run dev          # development server
npm test             # unit and component tests (Vitest)
npm run build        # type-check, then build a static dist/
npm run preview      # serve dist/ locally
```

End-to-end tests (Playwright) need a one-time browser install, then:

```sh
npx playwright install chromium
npm run test:e2e
```

## Edit the framework

All structure lives in `data/framework.json`: `domains`, each with `subdomains`, each with `questions` (`gate` is `{from, to}` or `null`) and `anchors` (`0` to `3`, or `null`). Scoring settings live under `scoring`: `weights` (domain id to weight; `null` means equal weights) and `minCoverage` (default 0.6).

Edit the file, save, and reload. New or changed subdomains appear everywhere without code changes. Anchors or gates set to `null` show as "Anchor not yet defined" or "Gate not yet assigned"; they are never filled in by the tool.

## How scoring works

- Subdomain score = stage ÷ 3 × 100 (stage 0 = 0%, no floor).
- Domain score = mean of the domain's subdomain scores, over rated subdomains only.
- National score = mean of the domain scores, equal weight by default. If weights are set, they are shown.
- `unknown` is dropped from every mean and listed. `na` is dropped and not counted as applicable.
- Coverage = rated ÷ applicable subdomains. It is shown next to every score.
- Sensitivity range = the same score with every unknown set to 0 (low) and to 3 (high).
- Below `minCoverage`, the tool shows "insufficient evidence" instead of a number.
- A national score is never shown alone. It always comes with its coverage, range, weakest domain and assessment type (self-assessed or externally assessed).

Every number links to a "How this number was made" panel.

## Data model

From `src/types.ts`:

```ts
export interface Evidence {
  text: string;
  source?: string;
  page?: string;
  url?: string;
  quote?: string;
}
export interface QuestionAnswer {
  answer: 'yes' | 'partly' | 'no' | 'unknown';
  note?: string;
}
export interface Rating {
  stage: StageValue;
  evidence: Evidence[];
  note?: string;
  missing?: string;
  answers?: Record<string, QuestionAnswer>;
  assessor?: string;
  updatedAt?: string;
  /** Required by the UI when the assessor overrides the stage suggested by the gates. */
  stageOverrideReason?: string;
}
export interface Assessment {
  id: string;
  country: string;
  asOf: string;
  mode: 'desk' | 'full';
  /** 'self' when absent. */
  assessedBy?: 'self' | 'external';
  assessedByNote?: string;
  assessors: string[];
  framework: string;
  summary?: string;
  sources?: AssessmentSource[];
  ratings: Record<string, Rating>;
  secondAssessor?: { name: string; ratings: Record<string, Rating> };
}
```

`StageValue` is `0 | 1 | 2 | 3 | 'unknown' | 'na'`. Ratings are keyed by subdomain id (for example `"1.1"`). A rated subdomain without evidence is flagged with a warning badge.

## Data storage and privacy

Assessments are stored only in the browser (IndexedDB). Import and export use JSON and CSV files that you control. Nothing is sent over the network at runtime, and there are no accounts or analytics.

## Draft status

- Framework (`data/framework.json`): "DRAFT for working-group review (30 Nov - 4 Dec 2026). Not validated."
- Strategy rules (`data/strategy-rules.json`): "PLACEHOLDER. Not agreed by the working group. The tool must show this status wherever the strategy card appears."

Both statuses are shown in the app and in every export.

---

Prototype developed at a WHO Collaborating Centre (ITA-120, CERC, Humanitas University). Draft for working-group review. Wording to be confirmed.
