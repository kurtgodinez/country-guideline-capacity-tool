/** Shared SVG <pattern> ids. Render <HatchDefs /> once in the document; any inline SVG can then fill with url(#id). */
export const PATTERN_IDS = {
  stage0: 'pat-stage-0',
  stage1: 'pat-stage-1',
  stage2: 'pat-stage-2',
  stage3: 'pat-stage-3',
  unknown: 'pat-unknown',
  na: 'pat-na',
} as const;

export const patternFill = (id: keyof typeof PATTERN_IDS): string => `url(#${PATTERN_IDS[id]})`;

export function HatchDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        <pattern id={PATTERN_IDS.stage0} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="var(--stage-0)" />
          <circle cx="3" cy="3" r="0.9" fill="var(--ink-muted)" />
        </pattern>
        <pattern id={PATTERN_IDS.stage1} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill="var(--stage-1)" />
          <line x1="0" y1="0" x2="0" y2="10" stroke="var(--stage-3)" strokeWidth="1.2" />
        </pattern>
        <pattern id={PATTERN_IDS.stage2} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="var(--stage-2)" />
        </pattern>
        <pattern id={PATTERN_IDS.stage3} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="var(--stage-3)" />
        </pattern>
        <pattern id={PATTERN_IDS.unknown} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--surface)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--unknown-hatch)" strokeWidth="1.5" />
        </pattern>
        <pattern id={PATTERN_IDS.na} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="var(--surface)" />
        </pattern>
      </defs>
    </svg>
  );
}
