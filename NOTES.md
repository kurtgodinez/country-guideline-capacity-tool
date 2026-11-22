# Notes: spec vs data conflicts

- **Weights and minCoverage location.** The spec says optional top-level `weights` / `minCoverage` in `framework.json`. In the data they live under `framework.scoring` (`scoring.weights` is `null`, `scoring.minCoverage` is `0.6`). `scoring.ts` reads `scoring.*` first, then the top-level fields, then the defaults (equal weights, 0.6).
- **Reference values checked.** All reference values in the spec match the data after rounding to whole percent (flat: Estonia 39% / 32-51 / 81%, Philippines 57% / 46-65 / 82%; domain-first: Estonia 40%, weakest domain 3 at 25%; Philippines 55%, weakest 2, 4, 8 at 44%). No conflicts found.
- **Domain-first ranges** (unknowns at 0 / at 3, per domain then averaged) are Estonia 32-52% and Philippines 45-64%; they differ by 1 point from the flat ranges.
- **Unrated subdomains.** A subdomain with no rating entry counts as applicable but not rated (excluded from means, lowers coverage). Both pilots rate all 49.
