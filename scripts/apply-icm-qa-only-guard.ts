import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(import.meta.dir, '..');
const guardsPath = path.join(root, 'test', 'helpers', 'carve-guards.ts');
let guards = fs.readFileSync(guardsPath, 'utf-8');
if (!guards.includes("'qa-only': {")) {
  const anchor = "  qa: {\n";
  const at = guards.indexOf(anchor);
  if (at < 0) throw new Error('Could not find qa carve guard anchor');
  const entry = `  'qa-only': {
    skill: 'qa-only',
    expectedSections: ['methodology.md'],
    requiredReads: ['methodology.md'],
    scenario:
      'Walk /qa-only in SIMULATION — do not launch a browser or execute bash. Treat the target as http://localhost:3000, mode as diff-aware on a feature branch, and no richer test plan as available. Read the pointed methodology section before the test pass, then produce the report-only QA plan and health-score rubric. Do not fix or suggest fixes. Do NOT use AskUserQuestion.',
    staticInvariants: {
      mustStayInSkeleton: [
        '## Setup',
        '## Test Plan Context',
        '## QA Test Pass',
        '## Output',
        '## Additional Rules (qa-only specific)',
        'Never fix bugs',
      ],
      mustPrecedeStop: ['## Setup', '## Test Plan Context'],
      mustMoveToSection: [
        '## Health Score Rubric',
        'Diff-aware',
        'Never refuse to use the browser',
      ],
      gateAfterStop: undefined,
    },
    behavioral: 'prompt',
    maxSkeletonBytes: 46_000,
    minUnionBytes: 60_000,
    mustContain: ['report', 'health score', 'screenshots', 'NEVER fix anything', 'Never fix bugs'],
  },
`;
  guards = guards.slice(0, at) + entry + guards.slice(at);
  fs.writeFileSync(guardsPath, guards);
}
