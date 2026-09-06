import * as fs from 'fs';

function replaceOnce(path: string, oldText: string, newText: string) {
  const src = fs.readFileSync(path, 'utf-8');
  if (!src.includes(oldText)) throw new Error(`anchor not found in ${path}`);
  fs.writeFileSync(path, src.replace(oldText, newText));
}

replaceOnce(
  'design-review/SKILL.md.tmpl',
  `{{LEARNINGS_SEARCH}}\n\n{{UX_PRINCIPLES}}\n\n## Phases 1-6: Design Audit Baseline\n\n{{DESIGN_METHODOLOGY}}\n\n{{DESIGN_HARD_RULES}}\n`,
  `{{LEARNINGS_SEARCH}}\n\n---\n\n{{SECTION_INDEX:design-review}}\n\n---\n\n## Phases 1-6: Design Audit Baseline\n\n{{SECTION:baseline-methodology}}\n`,
);

const anchor = `  // ── Token-reduction Phase 4 wave 3 (v1.69.x branch) ──────────────────────\n  qa: {\n`;
const entry = `  // ── Ace-Pi ICM Codex wave 2 ─────────────────────────────────────────────\n  'design-review': {\n    skill: 'design-review',\n    expectedSections: ['baseline-methodology.md'],\n    requiredReads: ['baseline-methodology.md'],\n    scenario:\n      'Walk /design-review in SIMULATION — do not launch a browser, run bash, edit source, or commit. Treat setup as complete: clean working tree, target http://localhost:3000, DESIGN.md present, Standard depth, designer unavailable. Read the pointed baseline section before the audit, then produce the Phase 1-6 audit plan and scoring criteria. Stop before Phase 7. Do NOT use AskUserQuestion.',\n    staticInvariants: {\n      mustStayInSkeleton: [\n        '## Setup',\n        'Check for clean working tree',\n        '## Phases 1-6: Design Audit Baseline',\n        '## Phase 7: Triage',\n        '## Phase 8: Fix Loop',\n        '## Phase 9: Final Design Audit',\n        '## Phase 10: Report',\n        '## Additional Rules (design-review specific)',\n        'One commit per fix',\n      ],\n      mustPrecedeStop: ['## Setup', 'Check for clean working tree'],\n      mustMoveToSection: [\n        "Don't make me think",\n        '## Health Score Rubric',\n        'Never refuse to use the browser',\n      ],\n      gateAfterStop: undefined,\n    },\n    behavioral: 'prompt',\n    maxSkeletonBytes: 76_000,\n    minUnionBytes: 85_000,\n    mustContain: ['design', 'fix', 'screenshot', 'AI slop', 'One commit per fix'],\n  },\n\n  // ── Token-reduction Phase 4 wave 3 (v1.69.x branch) ──────────────────────\n  qa: {\n`;
replaceOnce('test/helpers/carve-guards.ts', anchor, entry);
