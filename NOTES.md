# Notes: spec vs data conflicts

- **Weights and minCoverage location.** The spec says optional top-level `weights` / `minCoverage` in `framework.json`. In the data they live under `framework.scoring` (`scoring.weights` is `null`, `scoring.minCoverage` is `0.6`). `scoring.ts` reads `scoring.*` first, then the top-level fields, then the defaults (equal weights, 0.6).
- **Reference values checked.** All reference values in the spec match the data after rounding to whole percent (flat: Estonia 39% / 32-51 / 81%, Philippines 57% / 46-65 / 82%; domain-first: Estonia 40%, weakest domain 3 at 25%; Philippines 55%, weakest 2, 4, 8 at 44%). No conflicts found.
- **Domain-first ranges** (unknowns at 0 / at 3, per domain then averaged) are Estonia 32-52% and Philippines 45-64%; they differ by 1 point from the flat ranges.
- **Unrated subdomains.** A subdomain with no rating entry counts as applicable but not rated (excluded from means, lowers coverage). Both pilots rate all 49.

## Strategy

- **Insufficient-evidence branch.** A group is "insufficient" when more than half of its subdomains are `unknown` or unrated (n/a is excluded from the median but does not count toward this), or when no numeric stage remains. Rules are evaluated in file order; if a rule references (via `median(group)`) an insufficient group, evaluation stops: `insufficientEvidence = true`, no rule fires, and the `otherwise` rule (R3) is deliberately NOT used as a fall-through. A rule that fires earlier (e.g. R1) is unaffected by groups only referenced later.
- Any comparison involving a null (unknown/n/a/unrated `stage(...)`, or an empty median) is false.
- Next steps skip subdomains already at stage 3 (no next stage up). Blocking lists every subdomain in any rule group at stage 0, unknown or unrated.
- **Weighted kappa.** If both raters use a single identical category, chance agreement is 1 and kappa is undefined; `linearWeightedKappa` returns `null` (also for no pairs).

## Demo limitations / TODO

- Lighthouse accessibility has not been formally measured (target is 95 or higher on Home, Workspace and Profile).
- Playwright browsers were not installed in the build environment, so the e2e smoke test (`e2e/smoke.spec.ts`) is written but has not been run.
- Print and PDF layout of the Report has not been checked across browsers.
- Strategy rules and scoring are placeholders pending working-group agreement.
